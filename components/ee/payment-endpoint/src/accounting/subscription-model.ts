/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Subscription } from '@gitpod/gitpod-protocol/lib/accounting-protocol';
import { Plans } from '@gitpod/gitpod-protocol/lib/plans';
import { orderByEndDateDescThenStartDateDesc, orderByStartDateAscEndDateAsc } from './accounting-util';

/**
 * This class maintains the following invariant on a given set of Subscriptions and over the offered operations:
 *  - Whenever a users paid (non-FREE) subscription starts: End his FREE subscription
 *  - For every period a user has non paid subscription: Grant him a FREE subscription
 */
export class SubscriptionModel {
    protected readonly result: SubscriptionModel.Result = SubscriptionModel.Result.create();

    constructor(protected readonly userId: string, protected readonly subscriptions: Subscription[]) {}

    add(newSubscription: Subscription): SubscriptionModel.Result {
        this.result.inserts.push(newSubscription);
        return this.result;
    }

    cancel(subscription: Subscription, cancellationDate: string, endDate?: string): SubscriptionModel.Result {
        Subscription.cancelSubscription(subscription, cancellationDate, endDate);
        this.result.updates.push(subscription);
        return this.result;
    }

    update(alteredSubscription: Subscription) {
        this.result.updates.push(alteredSubscription);
        return this.result;
    }

    findOpenSubscriptions(planId?: string): Subscription[] {
        let subscriptionsForPaymentRef = this.subscriptions.filter((s) => !s.endDate);
        if (planId) {
            subscriptionsForPaymentRef = subscriptionsForPaymentRef.filter((s) => s.planId == planId);
        }

        return subscriptionsForPaymentRef.sort(orderByEndDateDescThenStartDateDesc);
    }

    findSubscriptionByPaymentReference(paymentReference: string): Subscription {
        const subscriptionsForPaymentRef = this.subscriptions.filter((s) => s.paymentReference === paymentReference);
        if (subscriptionsForPaymentRef.length === 0) {
            throw new Error(
                `Expected to find an existing Gitpod subscription for payment reference: ${paymentReference}`,
            );
        }
        return subscriptionsForPaymentRef.sort(orderByEndDateDescThenStartDateDesc)[0];
    }

    findSubscriptionByTeamSubscriptionSlotId(slotId: string): Subscription | undefined {
        const subscriptionsForSlot = this.subscriptions.filter((s) => s.teamSubscriptionSlotId === slotId);
        if (subscriptionsForSlot.length === 0) {
            return undefined;
        }
        return subscriptionsForSlot.sort(orderByEndDateDescThenStartDateDesc)[0];
    }

    getResult(): SubscriptionModel.Result {
        return SubscriptionModel.Result.copy(this.result);
    }

    /**
     * Merge operations with subscriptions
     */
    merged(): Subscription[] {
        const subs = this.subscriptions.map((s) => ({ ...s }));
        const operations = this.result;

        for (const s2 of operations.updates) {
            const index = subs.findIndex((s) => s.uid === s2.uid);
            if (index === -1) {
                subs.push({ ...s2 });
            } else {
                subs[index] = {
                    ...subs[index],
                    ...s2,
                };
            }
        }
        operations.inserts.forEach((i) => subs.push(i));
        return subs.sort(orderByEndDateDescThenStartDateDesc);
    }

    mergedWithFreeSubscriptions(userCreationDate: string): Subscription[] {
        const subscriptions = this.merged();
        return this.insertFreeSubscriptions(subscriptions, userCreationDate).sort(orderByEndDateDescThenStartDateDesc);
    }

    /**
     * Creates the following invariants on the given set of Subscriptions:
     *  - A user is granted a FREE subscription iff he has no paid subscription
     *  - For any given time from user.creationDate until forever the user has at least one subscription
     * TODO Handle mis-use: Only grant a user FREE.hours par Month at most
     * @param subscriptions
     * @param userCreationDate
     */
    protected insertFreeSubscriptions(subscriptions: Subscription[], userCreationDate: string): Subscription[] {
        const addFreeSub = (startDate: string, cancellationDate?: string) => {
            const freePlan = Plans.getFreePlan(userCreationDate);
            const s = Subscription.create({
                userId: this.userId,
                startDate: startDate,
                planId: freePlan.chargebeeId,
                amount: Plans.getHoursPerMonth(freePlan),
            });
            if (cancellationDate) {
                Subscription.cancelSubscription(s, cancellationDate);
            }
            subscriptions.push(s);
        };

        // Go over all time periods the user already has an (paid) subscription and insert FREE subscriptions in between
        const periods = this.calcSubscriptionPeriods(subscriptions);
        let currentStartDate: string | undefined = userCreationDate;
        const it = periods.entries();
        let pit = it.next();
        while (currentStartDate && !pit.done) {
            const [, period] = pit.value;
            if (currentStartDate < period.startDate) {
                addFreeSub(currentStartDate, period.startDate);
            }
            // No need to go back in time, as this is already covered by prior periods
            if (!period.endDate || period.endDate > currentStartDate) {
                currentStartDate = period.endDate;
            }
            pit = it.next();
        }
        if (currentStartDate) {
            // The last period has a fix endDate: Add another subscription after that
            addFreeSub(currentStartDate, undefined);
        }

        return subscriptions;
    }

    protected calcSubscriptionPeriods(subscriptions: Subscription[]): Period[] {
        if (subscriptions.length === 0) return [];
        subscriptions = subscriptions.sort(orderByStartDateAscEndDateAsc);

        const it = subscriptions.entries();
        const periods: Period[] = [];
        let previous: Period = Period.from(it.next().value[1]);
        let currentIt = it.next();
        while (!currentIt.done) {
            const [, current] = currentIt.value;
            if (previous.endDate) {
                // We have to distinguish 3 cases:
                if (current.endDate && current.endDate < previous.endDate) {
                    // 1. total overlap: previous is longer than current
                } else if (Period.within(previous.endDate, current)) {
                    // 2. partial overlap: previous and current overlap: extend by taking over endDate
                    previous.endDate = current.endDate;
                } else {
                    // 3. no overlap: push current
                    periods.push(previous);
                    previous = Period.from(current);
                }
            }
            currentIt = it.next();
        }
        periods.push(previous);
        return periods;
    }
}

interface Period {
    startDate: string;
    endDate?: string;
}
namespace Period {
    export const within = (date: string, p: Period) =>
        p.startDate <= date && (p.endDate === undefined || date < p.endDate);
    export const from = (p: Period): Period => ({ startDate: p.startDate, endDate: p.endDate });
}

export namespace SubscriptionModel {
    export interface Result {
        updates: Subscription[];
        inserts: Subscription[];
    }
    export namespace Result {
        export const create = () => {
            return { updates: [], inserts: [] };
        };
        export const copy = (other: Result) => {
            return {
                updates: [...other.updates],
                inserts: [...other.inserts],
            };
        };
    }
}
