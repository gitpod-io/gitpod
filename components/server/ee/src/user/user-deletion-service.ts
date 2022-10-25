/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { UserDeletionService } from "../../../src/user/user-deletion-service";
import { SubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting/subscription-service";
import { Plans } from "@gitpod/gitpod-protocol/lib/plans";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { ChargebeeService } from "./chargebee-service";
import { StripeService } from "./stripe-service";
import { TeamSubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class UserDeletionServiceEE extends UserDeletionService {
    @inject(ChargebeeService) protected readonly chargebeeService: ChargebeeService;
    @inject(StripeService) protected readonly stripeService: StripeService;
    @inject(SubscriptionService) protected readonly subscriptionService: SubscriptionService;
    @inject(TeamSubscriptionService) protected readonly teamSubscriptionService: TeamSubscriptionService;

    async deleteUser(id: string): Promise<void> {
        const user = await this.db.findUserById(id);
        if (!user) {
            throw new Error(`No user with id ${id} found!`);
        }

        const errors = [];
        if (this.config.enablePayment) {
            const now = new Date();
            const chargebeeSubscriptions = await this.subscriptionService.getNotYetCancelledSubscriptions(
                user,
                now.toISOString(),
            );
            for (const chargebeeSubscription of chargebeeSubscriptions) {
                try {
                    const planId = chargebeeSubscription.planId!;
                    const paymentReference = chargebeeSubscription.paymentReference;
                    if (Plans.isFreeNonTransientPlan(planId)) {
                        // only delete those plans that are persisted in the DB
                        await this.subscriptionService.unsubscribe(user.id, now.toISOString(), planId);
                    } else if (Plans.isFreePlan(planId)) {
                        // we do not care about transient plans
                        continue;
                    } else {
                        if (!paymentReference) {
                            const teamSlots = await this.teamSubscriptionService.findTeamSubscriptionSlotsByAssignee(
                                id,
                            );
                            teamSlots.forEach(
                                async (ts) =>
                                    await this.teamSubscriptionService.deactivateSlot(
                                        ts.teamSubscriptionId,
                                        ts.id,
                                        now,
                                    ),
                            );
                        } else if (paymentReference.startsWith("github:")) {
                            throw new Error("Cannot delete user subscription from GitHub");
                        } else {
                            // cancel Chargebee subscriptions
                            const subscriptionId = chargebeeSubscription.uid;
                            const chargebeeSubscriptionId = chargebeeSubscription.paymentReference!;
                            await this.chargebeeService.cancelSubscription(
                                chargebeeSubscriptionId,
                                { userId: user.id },
                                { subscriptionId, chargebeeSubscriptionId },
                            );
                        }
                    }
                } catch (error) {
                    errors.push(error);
                    log.error("Error cancelling Chargebee user subscription", error, {
                        subscription: chargebeeSubscription,
                    });
                }
            }
            // Also cancel any usage-based (Stripe) subscription
            const subscriptionId = await this.stripeService.findUncancelledSubscriptionByAttributionId(
                AttributionId.render({ kind: "user", userId: user.id }),
            );
            try {
                if (subscriptionId) {
                    await this.stripeService.cancelSubscription(subscriptionId);
                }
            } catch (error) {
                errors.push(error);
                log.error("Error cancelling Stripe user subscription", error, { subscriptionId });
            }
        }

        await super.deleteUser(id);
        if (errors.length > 0) {
            throw new Error(errors.join("\n"));
        }
    }
}
