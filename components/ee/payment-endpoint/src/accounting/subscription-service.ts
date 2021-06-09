/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { AccountingDB } from "@gitpod/gitpod-db/lib/accounting-db";
import { User } from "@gitpod/gitpod-protocol";
import { AccountEntry, Subscription } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { inject, injectable } from "inversify";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { Plan, Plans } from "@gitpod/gitpod-protocol/lib/plans";
import { orderByStartDateAscEndDateAsc } from "./accounting-util";
import { SubscriptionModel } from "./subscription-model";

export type UserCreated = Pick<User, 'id' | 'creationDate'>;

@injectable()
export class SubscriptionService {
    @inject(AccountingDB) accountingDB: AccountingDB;

    /**
     *
     * @param user
     * @returns All persisted subscriptions + the Free subscriptions that fill up the periods in between, sorted by startDate (ASC)
     */
    async getSubscriptionHistoryForUserInPeriod(user: UserCreated, startDate: string, endDate: string): Promise<Subscription[]> {
        const subscriptions = await this.accountingDB.findSubscriptionsForUserInPeriod(user.id, startDate, endDate);
        const model = new SubscriptionModel(user.id, subscriptions);
        return model
            .mergedWithFreeSubscriptions(user.creationDate)
            .sort(orderByStartDateAscEndDateAsc);
    }

    /**
     * @param user
     * @param date
     * @returns All persisted subscriptions that are either a) not cancelled or b) have a cancellationDate after date + the Free subscriptions that fill up the periods in between, sorted by startDate (ASC)
     */
    async getNotYetCancelledSubscriptions(user: UserCreated, date: string): Promise<Subscription[]> {
        const subscriptions = await this.accountingDB.findNotYetCancelledSubscriptions(user.id, date);
        const model = new SubscriptionModel(user.id, subscriptions);
        return model
            .mergedWithFreeSubscriptions(user.creationDate)
            .sort(orderByStartDateAscEndDateAsc);
    }

    /**
     * @param userId
     * @param endDate
     */
    async unsubscribe(userId: string, endDate: string, planId: string): Promise<void> {
        if (!Plans.isFreePlan(planId)) {
            throw new Error("unsubscribe only works for 'free' plans!");
        }

        return this.accountingDB.transaction(async db => {
            await this.doUnsubscribe(db, userId, endDate, planId);
        });
    }

    /**
     * @param userId
     * @param plan
     * @param paymentReference
     * @param startDate
     * @param endDate
     */
    async subscribe(userId: string, plan: Plan, paymentReference: string | undefined, startDate: string, endDate?: string): Promise<Subscription> {
        if (!Plans.isFreePlan(plan.chargebeeId)) {
            throw new Error("subscribe only works for 'free' plans!");
        }

        return this.accountingDB.transaction(async db => {
            await this.doUnsubscribe(db, userId, startDate, plan.chargebeeId);
            const newSubscription = <Subscription> {
                userId,
                amount: Plans.getHoursPerMonth(plan),
                planId: plan.chargebeeId,
                paymentReference,
                startDate,
                endDate };
            log.info({ userId }, 'Creating subscription', { subscription: newSubscription });
            return db.newSubscription(newSubscription);
        });
    }

    async addCredit(userId: string, amount: number, date: string, expiryDate?: string): Promise<AccountEntry> {
        const entry = <AccountEntry> {
            userId, amount, date, expiryDate, kind: 'credit'
        };
        log.info({ userId }, 'Adding credit', { accountEntry: entry });
        return this.accountingDB.newAccountEntry(entry);
    }

    /**
     * @param userId
     * @param date The date on which the subscription has to be active
     * @returns Whether the user has an active subscription (user-paid or team s.) at the given date
     */
    async hasActiveAndNotYetCancelledPaidSubscription(userId: string, date: Date): Promise<boolean> {
        const subscriptions = await this.accountingDB.findActiveSubscriptionsForUser(userId, date.toISOString());
        return subscriptions
            .filter(s => Subscription.isActive(s, date.toISOString()) && !Subscription.isCancelled(s))
            .length > 0;
    }

    async store(db: AccountingDB, model: SubscriptionModel) {
        const delta = model.getResult();
        await Promise.all([
            ...delta.updates.map(s => db.storeSubscription(s)),
            ...delta.inserts.map(s => db.newSubscription(s))
        ]);
    }

    private async doUnsubscribe(db: AccountingDB, userId: string, endDate: string, planId: string) : Promise<Subscription[]>{
        const subscriptions = await db.findAllSubscriptionsForUser(userId);
        for (let subscription of subscriptions) {
            if (planId === subscription.planId) {
                if (!subscription.endDate || endDate <= subscription.endDate) {
                    if (subscription.startDate < endDate)
                    Subscription.cancelSubscription(subscription, endDate);
                    else
                    Subscription.cancelSubscription(subscription, subscription.startDate);
                    log.info({ userId }, 'Canceling subscription', { subscription });
                    await db.storeSubscription(subscription);
                }
            }
        }
        return subscriptions;
    }
}
