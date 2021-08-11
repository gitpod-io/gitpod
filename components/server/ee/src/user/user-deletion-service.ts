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
import { EnvEE } from "../env";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
@injectable()
export class UserDeletionServiceEE extends UserDeletionService {
    @inject(ChargebeeService) protected readonly chargebeeService: ChargebeeService;
    @inject(SubscriptionService) protected readonly subscriptionService: SubscriptionService;
    @inject(EnvEE) protected readonly env: EnvEE;

    async deleteUser(id: string): Promise<void> {
        const user = await this.db.findUserById(id);
        if (!user) {
            throw new Error(`No user with id ${id} found!`);
        }

        if (this.env.enablePayment) {
            const now = new Date().toISOString();
            const subscriptions = await this.subscriptionService.getNotYetCancelledSubscriptions(user, now);
            for (const subscription of subscriptions) {
                const planId = subscription.planId!;
                if (Plans.isFreeNonTransientPlan(planId)) {
                    // only try delete those plans that are persisted in the DB
                    try {
                        await this.subscriptionService.unsubscribe(user.id, now, planId);
                    } catch (e) {
                        log.info(e);
                    }
                } else if (Plans.isFreePlan(planId)) {
                    // we do not care about transient plans
                    continue;
                } else {
                    // try cancel Chargebee subscriptions
                    const subscriptionId = subscription.uid;
                    const chargebeeSubscriptionId = subscription.paymentReference!;
                    try {
                        await this.chargebeeService.cancelSubscription(chargebeeSubscriptionId, { userId: user.id }, { subscriptionId, chargebeeSubscriptionId });
                    } catch (e) {
                        log.info(e);
                    }
                }
            }
        }

        return super.deleteUser(id);
    }
}