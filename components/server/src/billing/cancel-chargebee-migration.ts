/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { LongRunningMigration } from "@gitpod/gitpod-db/lib/long-running-migration/long-running-migration";
import { AccountingDB, TeamSubscription2DB, TeamSubscriptionDB } from "@gitpod/gitpod-db/lib";
import { ChargebeeService } from "../../ee/src/user/chargebee-service";
import { Subscription } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { Plans } from "@gitpod/gitpod-protocol/lib/plans";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TeamSubscription, TeamSubscription2 } from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";

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

@injectable()
export class CancelChargebeeTeamSubscriptionsMigration implements LongRunningMigration {
    @inject(TeamSubscriptionDB) protected readonly teamSubscriptionDB: TeamSubscriptionDB;
    @inject(ChargebeeService) protected readonly chargebeeService: ChargebeeService;

    getName(): string {
        return "cancel-chargebee-team-subscriptions";
    }

    /**
     * This migration cancels all Chargebee Team Subscriptions in the database that are still active and not yet cancelled.
     */
    async runMigrationBatch(): Promise<boolean> {
        const now = new Date().toISOString();

        const allTss = await this.teamSubscriptionDB.findActiveTeamSubscriptions(now, 100);
        const activeNotCancelledTss = allTss.filter(
            (ts) => TeamSubscription.isActive(ts, now) && !TeamSubscription.isCancelled(ts, now),
        );

        let todo = activeNotCancelledTss.length;
        for (const ts of activeNotCancelledTss) {
            const userId = ts.userId;
            if (!ts.paymentReference) {
                log.warn({ userId }, "Cancel: Team Subscription without payment reference", {
                    tsId: ts.id,
                });
                todo = -1;
                continue;
            }

            try {
                const chargebeeSubscriptionId = ts.paymentReference;
                await this.chargebeeService.cancelSubscription(
                    chargebeeSubscriptionId,
                    { userId },
                    { tsId: ts.id, paymentReference: ts.paymentReference },
                );
                log.info({ userId }, "Cancel: Team Subscription cancelled", {
                    tsId: ts.id,
                    paymentReference: ts.paymentReference,
                });
            } catch (err) {
                log.error({ userId }, "Cancel: Error cancelling Team Subscription, skipping for now", err, {
                    tsId: ts.id,
                    paymentReference: ts.paymentReference,
                });
                todo = -1;
            }
        }

        return todo === 0;
    }
}

@injectable()
export class CancelChargebeeTeamSubscriptions2Migration implements LongRunningMigration {
    @inject(TeamSubscription2DB) protected readonly teamSubscription2DB: TeamSubscription2DB;
    @inject(ChargebeeService) protected readonly chargebeeService: ChargebeeService;

    getName(): string {
        return "cancel-chargebee-team-subscriptions2";
    }

    /**
     * This migration cancels all Chargebee Team Subscriptions 2 in the database that are still active and not yet cancelled.
     */
    async runMigrationBatch(): Promise<boolean> {
        const now = new Date().toISOString();

        const allTs2s = await this.teamSubscription2DB.findActiveTeamSubscriptions(now, 100);
        const activeNotCancelledTs2s = allTs2s.filter(
            (ts) => TeamSubscription2.isActive(ts, now) && !TeamSubscription2.isCancelled(ts, now),
        );

        let todo = activeNotCancelledTs2s.length;
        for (const ts2 of activeNotCancelledTs2s) {
            const teamId = ts2.teamId;
            if (!ts2.paymentReference) {
                log.warn({}, "Cancel: Team Subscription 2 without payment reference", {
                    teamId,
                    ts2Id: ts2.id,
                });
                todo = -1;
                continue;
            }

            try {
                const chargebeeSubscriptionId = ts2.paymentReference;
                await this.chargebeeService.cancelSubscription(
                    chargebeeSubscriptionId,
                    {},
                    { teamId, ts2Id: ts2.id, paymentReference: ts2.paymentReference },
                );
                log.info({}, "Cancel: Team Subscription 2 cancelled", {
                    teamId,
                    ts2Id: ts2.id,
                    paymentReference: ts2.paymentReference,
                });
            } catch (err) {
                log.error({}, "Cancel: Error cancelling Team Subscription 2, skipping for now", err, {
                    teamId,
                    ts2Id: ts2.id,
                    paymentReference: ts2.paymentReference,
                });
                todo = -1;
            }
        }

        return todo === 0;
    }
}
