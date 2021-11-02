/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

 import { v4 as uuidv4 } from 'uuid';
import { User } from './protocol';
import { oneMonthLater } from './util/timeutil';

/*
 * Subscription and acocunting data
 */
export interface AccountEntry {
    uid: string;

    userId: string;

    /** [hours] */
    amount: number;

    /**
     * credit: start of validity,
     * session: end of (split-) session
     */
    date: string;

    /**
     * debits (session, expiry, loss): relation to credit
     */
    creditId?: string;

    /**
     * credit: end of validity
     */
    expiryDate?: string;         // exclusive

    kind: AccountEntryKind;

    /**
     * credit: amount - accounted debits
     * [hours]
     */
    remainingAmount?: number;

    description?: object;
}
export namespace AccountEntry {
    export function create<T extends AccountEntry>(entry: Omit<T, 'uid'>): T {
        const result = entry as T;
        result.uid = uuidv4();
        return result;
    };
}

export type DebitAccountEntryKind = 'session' | 'expiry' | 'loss';
export type AccountEntryKind = 'credit' | DebitAccountEntryKind | 'carry' | 'open';

export interface Credit extends AccountEntry {
    kind: 'credit';
    expiryDate: string;
}
export type Debit = LossDebit | ExpiryDebit | SessionDebit;
export interface LossDebit extends AccountEntry {
    kind: 'loss';
}
export interface ExpiryDebit extends AccountEntry {
    kind: 'expiry';
    creditId: undefined;
}
export interface SessionDebit extends AccountEntry {
    kind: DebitAccountEntryKind;
    creditId: string;
}

export type AccountEntryDescription = SessionDescription | CreditDescription;
export interface CreditDescription {
    subscriptionId: string;
    planId: string;
}
export namespace CreditDescription {
    export function is(obj: any): obj is CreditDescription {
        return !!obj
            && obj.hasOwnProperty('subscriptionId')
            && obj.hasOwnProperty('planId');
    }
}
export interface SessionDescription {
    contextTitle: string;
    contextUrl: string;
    workspaceId: string;
    workspaceInstanceId: string;
    private: boolean;
}
export namespace SessionDescription {
    export function is(obj: any): obj is SessionDescription {
        return !!obj
            && obj.hasOwnProperty('contextTitle')
            && obj.hasOwnProperty('contextUrl')
            && obj.hasOwnProperty('workspaceId')
            && obj.hasOwnProperty('workspaceInstanceId')
            && obj.hasOwnProperty('private');
    }
}

/**
 * - The earliest subscription may start with User.creationDate
 * - There may be multiple Gitpod subscriptions for a user at any given time
 * - The dates form an interval of the form: [startDate, endDate)
 * - Subscriptions that directly map to a Chargebee plan have their paymentReference set and MAY carry additional paymentData (UserPaidSubscription)
 * - Subscriptions that are assigned to a user through a Team Subscription carry a teamSubscriptionSlotId (AssignedTeamSubscription)
 */
export interface Subscription {
    uid: string;
    userId: string;
    startDate: string;           // inclusive
    /** When the subscription will end (must be >= cancellationDate!) */
    endDate?: string;            // exclusive
    /** When the subscription was cancelled */
    cancellationDate?: string;   // exclusive
    /** Number of granted hours */
    amount: number;
    /** Number of granted hours for the first month: If this is set, use this value for the first month */
    firstMonthAmount?: number;
    planId?: string;
    paymentReference?: string;
    paymentData?: PaymentData;
    teamSubscriptionSlotId?: string;
    /** marks the subscription as deleted */
    deleted?: boolean;
}

export interface SubscriptionAndUser extends Subscription {
    user: User;
}

export interface PaymentData {
    /** Marks the date as of which the _switch_ is effective. */
    downgradeDate?: string;
    /** Determines the new plan the dowgrade is targeted against (optional for backwards compatibility) */
    newPlan?: string;
}

export interface UserPaidSubscription extends Subscription {
    paymentReference: string;
    paymentData?: PaymentData;
}
export namespace UserPaidSubscription {
    export function is(data: any): data is UserPaidSubscription {
        return !!data
            && data.hasOwnProperty('paymentReference');
    }
}

export interface AssignedTeamSubscription extends Subscription {
    teamSubscriptionSlotId: string;
}
export namespace AssignedTeamSubscription {
    export function is(data: any): data is AssignedTeamSubscription {
        return !!data
            && data.hasOwnProperty('teamSubscriptionSlotId');
    }
}

export namespace Subscription {
    export function create(newSubscription: Omit<Subscription, 'uid'>) {
        const subscription = newSubscription as Subscription;
        subscription.uid = uuidv4();
        return subscription;
    };
    export function cancelSubscription(s: Subscription, cancellationDate: string, endDate?: string) {
        s.endDate = endDate || cancellationDate;
        s.cancellationDate = cancellationDate;
    };
    export function isSame(s1: Subscription | undefined, s2: Subscription | undefined): boolean {
        return !!s1 && !!s2
            && s1.userId === s2.userId
            && s1.planId === s2.planId
            && s1.startDate === s2.startDate
            && s1.endDate === s2.endDate
            && s1.amount === s2.amount
            && s1.cancellationDate === s2.cancellationDate
            && s1.deleted === s2.deleted
            && ((s1.paymentData === undefined && s2.paymentData === undefined)
                || (!!s1.paymentData && !!s2.paymentData
                    && s1.paymentData.downgradeDate === s2.paymentData.downgradeDate
                    && s1.paymentData.newPlan === s2.paymentData.newPlan));
    };
    export function isActive(s: Subscription, date: string): boolean {
        return s.startDate <= date && (s.endDate === undefined || date < s.endDate);
    };
    export function isDowngraded(s: Subscription) {
        return s.paymentData && s.paymentData.downgradeDate;
    };
    export function calculateCurrentPeriod(startDate: string, now: Date) {
        let nextStartDate = startDate;
        do {
            startDate = nextStartDate;
            nextStartDate = oneMonthLater(startDate, new Date(startDate).getDate());
        } while (nextStartDate < now.toISOString());
        return { startDate, endDate: nextStartDate };
    };
}

export type MaybeSubscription = Subscription | undefined;

export interface Period {
    startDate: string;           // inclusive
    endDate: string;             // exclusive
}

export type MaybePeriod = Period | undefined;

export type AccountEntryFixedPeriod = Omit<AccountEntry, 'uid'> & { expiryDate: string };
export interface AccountStatement extends Period {
    userId: string;
    /**
     * The subscriptions that have not been cancelled yet at the end of the period
     */
    subscriptions: Subscription[];
    credits: Credit[];
    debits: Debit[];
    /** Remaining valid hours (accumulated from credits) */
    remainingHours: RemainingHours;
}
export type RemainingHours = number | 'unlimited';

export interface CreditAlert {
    userId: string,
    remainingUsageHours: number
}
