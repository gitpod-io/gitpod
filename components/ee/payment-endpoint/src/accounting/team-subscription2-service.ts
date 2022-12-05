/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AccountingDB, TeamDB } from "@gitpod/gitpod-db/lib";
import { AssignedTeamSubscription2, Subscription } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { Plans } from "@gitpod/gitpod-protocol/lib/plans";
import { TeamSubscription2 } from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";
import { inject, injectable } from "inversify";
import { SubscriptionModel } from "./subscription-model";
import { SubscriptionService } from "./subscription-service";

@injectable()
export class TeamSubscription2Service {
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(AccountingDB) protected readonly accountingDb: AccountingDB;
    @inject(SubscriptionService) protected readonly subscriptionService: SubscriptionService;

    async addAllTeamMemberSubscriptions(ts2: TeamSubscription2): Promise<void> {
        const members = await this.teamDB.findMembersByTeam(ts2.teamId);
        for (const member of members) {
            await this.addTeamMemberSubscription(ts2, member.userId);
        }
    }

    async addTeamMemberSubscription(ts2: TeamSubscription2, userId: string): Promise<void> {
        const membership = await this.teamDB.findTeamMembership(userId, ts2.teamId);
        if (!membership) {
            throw new Error(`Could not find membership for user '${userId}' in team '${ts2.teamId}'`);
        }
        const plan = Plans.getById(ts2.planId)!;
        const { startDate } = Subscription.calculateCurrentPeriod(ts2.startDate, new Date());
        return this.accountingDb.transaction(async (db) => {
            const subscription = await this.addSubscription(db, userId, ts2.planId, membership.id, startDate, Plans.getHoursPerMonth(plan));
            await this.teamDB.setTeamMemberSubscription(userId, ts2.teamId, subscription.uid);
        });
    }

    protected async addSubscription(db: AccountingDB, userId: string, planId: string, teamMembershipId: string, startDate: string, amount: number, firstMonthAmount?: number, endDate?: string, cancelationDate?: string) {
        const model = await this.loadSubscriptionModel(db, userId);
        const subscription = Subscription.create({
            userId,
            planId,
            amount,
            startDate,
            endDate,
            cancellationDate: cancelationDate || endDate,
            teamMembershipId,
            firstMonthAmount
        });
        model.add(subscription);
        await this.subscriptionService.store(db, model);
        return subscription;
    }

    async cancelAllTeamMemberSubscriptions(ts2: TeamSubscription2, date: Date): Promise<void> {
        const members = await this.teamDB.findMembersByTeam(ts2.teamId);
        for (const member of members) {
            const membership = await this.teamDB.findTeamMembership(member.userId, ts2.teamId);
            if (!membership) {
                throw new Error(`Could not find membership for user '${member.userId}' in team '${ts2.teamId}'`);
            }
            await this.cancelTeamMemberSubscription(ts2, member.userId, membership.id, date);
        }
    }

    async cancelTeamMemberSubscription(ts2: TeamSubscription2, userId: string, teamMemberShipId: string, date: Date): Promise<void> {
        const { endDate } = Subscription.calculateCurrentPeriod(ts2.startDate, date);
        return this.accountingDb.transaction(async (db) => {
            await this.cancelSubscription(db, userId, ts2.planId, teamMemberShipId, endDate);
        });
    }

    protected async cancelSubscription(db: AccountingDB, userId: string, planId: string, teamMembershipId: string, cancellationDate: string) {
        const model = await this.loadSubscriptionModel(db, userId);
        const subscription = model.findSubscriptionByTeamMembershipId(teamMembershipId);
        if (!subscription) {
            throw new Error(`Cannot find subscription for Team Membership '${teamMembershipId}'!`);
        }
        model.cancel(subscription, cancellationDate, cancellationDate);
        await this.subscriptionService.store(db, model);
    }

    protected async loadSubscriptionModel(db: AccountingDB, userId: string) {
        const subscriptions = await db.findAllSubscriptionsForUser(userId);
        const subscriptionsFromTS = subscriptions.filter(s => AssignedTeamSubscription2.is(s));
        return new SubscriptionModel(userId, subscriptionsFromTS);
    }

}
