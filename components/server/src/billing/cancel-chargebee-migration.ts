/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { LongRunningMigration } from "@gitpod/gitpod-db/lib/long-running-migration/long-running-migration";
import { AccountingDB } from "@gitpod/gitpod-db/lib";
import { ChargebeeService } from "../../ee/src/user/chargebee-service";
import { Subscription } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { Plans } from "@gitpod/gitpod-protocol/lib/plans";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class CancelChargebeePersonalSubscriptionsMigration implements LongRunningMigration {
    @inject(AccountingDB) protected readonly db: AccountingDB;
    @inject(ChargebeeService) protected readonly chargebeeService: ChargebeeService;

    getName(): string {
        return "cancel-chargebee-personal-subscriptions";
    }

    /**
     * This migration cancels all Chargebee Personal subscriptions in the database that are still active and not yet cancelled.
     */
    async runMigrationBatch(): Promise<boolean> {
        const now = new Date().toISOString();

        const subscriptions = await this.db.findActiveSubscriptions(now, now, 100);
        // Same filter as in gitpod-server-impl:calculatePayAsYouGoNotifications
        const activeNotCancelledSubscriptions = subscriptions.filter(
            (s) => Plans.isPersonalPlan(s.planId) && !Plans.isFreePlan(s.planId) && !Subscription.isCancelled(s, now), // We only care about existing, active, not-yet-cancelled subs
        );

        let todo = activeNotCancelledSubscriptions.length;
        for (const subscription of activeNotCancelledSubscriptions) {
            const userId = subscription.userId;
            if (!subscription.paymentReference) {
                log.warn({ userId }, "Cancel: Subscription without payment reference", {
                    subscriptionId: subscription.uid,
                });
                todo = -1;
                continue;
            }
            if (subscription.paymentReference.startsWith("github:")) {
                log.warn({ userId }, "Cancel: GitHub subscription", {
                    subscriptionId: subscription.uid,
                    paymentReference: subscription.paymentReference,
                });
                todo = -1;
                continue;
            }

            try {
                const chargebeeSubscriptionId = subscription.paymentReference;
                await this.chargebeeService.cancelSubscription(
                    chargebeeSubscriptionId,
                    { userId },
                    { subscriptionId: subscription.uid, paymentReference: subscription.paymentReference },
                );
                log.info({ userId }, "Cancel: Subscription cancelled", {
                    subscriptionId: subscription.uid,
                    paymentReference: subscription.paymentReference,
                });
            } catch (err) {
                log.error({ userId }, "Cancel: Error cancelling subscription, skipping for now", err, {
                    subscriptionId: subscription.uid,
                    paymentReference: subscription.paymentReference,
                });
                todo = -1;
            }
        }

        return todo === 0;
    }
}
