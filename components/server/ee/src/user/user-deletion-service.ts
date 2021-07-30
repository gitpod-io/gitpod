/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { UserDeletionService } from "../../../src/user/user-deletion-service";
import { SubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting/subscription-service";
import { Plans } from "@gitpod/gitpod-protocol/lib/plans";
import { ChargebeeService } from "./chargebee-service";
import { TeamSubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

@injectable()
export class UserDeletionServiceEE extends UserDeletionService {
    @inject(ChargebeeService) protected readonly chargebeeService: ChargebeeService;
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
            const subscriptions = await this.subscriptionService.getNotYetCancelledSubscriptions(user, now.toISOString());
            for (const subscription of subscriptions) {
                try {
                    const planId = subscription.planId!;
                    const paymentReference = subscription.paymentReference;
                    if (Plans.isFreeNonTransientPlan(planId)) {
                        // only delete those plans that are persisted in the DB
                        await this.subscriptionService.unsubscribe(user.id, now.toISOString(), planId);
                    } else if (Plans.isFreePlan(planId)) {
                        // we do not care about transient plans
                        continue;
                    } else {
                        if (!paymentReference) {
                            const teamSlots = await this.teamSubscriptionService.findTeamSubscriptionSlotsByAssignee(id);
                            teamSlots.forEach(async ts => await this.teamSubscriptionService.deactivateSlot(ts.teamSubscriptionId, ts.id, now))
                        } else if (paymentReference.startsWith("github:")) {
                            throw new Error("Cannot delete user subscription from GitHub")
                        } else {
                            // cancel Chargebee subscriptions
                            const subscriptionId = subscription.uid;
                            const chargebeeSubscriptionId = subscription.paymentReference!;
                            await this.chargebeeService.cancelSubscription(chargebeeSubscriptionId, { userId: user.id }, { subscriptionId, chargebeeSubscriptionId });
                        }
                    }
                } catch (error) {
                    errors.push(error);
                    log.error("Error cancelling subscription", error, { subscription })
                }
            }
        }

        await super.deleteUser(id);
        if (errors.length > 0) {
            throw new Error(errors.join("\n"))
        }
    }
}
