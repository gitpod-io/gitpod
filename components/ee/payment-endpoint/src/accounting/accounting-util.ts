/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Subscription, AccountEntry, AccountEntryFixedPeriod } from '@gitpod/gitpod-protocol/lib/accounting-protocol';

const toInt = (dateStr?: string) => (dateStr ? new Date(dateStr).getTime() : Number.MAX_SAFE_INTEGER);
export const orderByEndDateDescThenStartDateDesc = (s1: Subscription, s2: Subscription) => {
    return toInt(s2.endDate) - toInt(s1.endDate) || toInt(s2.startDate) - toInt(s1.startDate);
};

export const orderByExpiryDateDesc = (e1: AccountEntry, e2: AccountEntry) => {
    return toInt(e2.expiryDate) - toInt(e1.expiryDate);
};

export const orderByDateDesc = (e1: AccountEntry, e2: AccountEntry) => {
    return toInt(e2.date) - toInt(e1.date);
};

export const orderByStartDateAscEndDateAsc = (s1: Subscription, s2: Subscription) => {
    return toInt(s1.startDate) - toInt(s2.startDate) || toInt(s1.endDate) - toInt(s2.endDate);
};

export const within = (date: string, period: AccountEntryFixedPeriod) => {
    return date >= period.date && (!period.expiryDate || date < period.expiryDate);
};

export const orderCreditFirst = (c1: AccountEntry, c2: AccountEntry) => {
    if (c1.kind === c2.kind) {
        return 0;
    } else if (c1.kind === 'open') {
        return -1;
    } else if (c2.kind === 'open') {
        return 1;
    }
    return 0;
};

export class SortedArray<T> {
    constructor(protected readonly array: T[], protected readonly comparator: (t1: T, t2: T) => number) {
        this.array.sort(this.comparator);
    }

    push(t: T) {
        this.array.push(t);
        this.array.sort(this.comparator);
    }

    pop(): T | undefined {
        return this.array.pop();
    }

    popFront(): T | undefined {
        const [popped] = this.array.splice(0, 1);
        return popped;
    }

    peekFront(): T | undefined {
        if (this.array.length < 1) {
            return undefined;
        }
        return this.array[0];
    }

    forEach(f: (t: T, index: number, arr: T[]) => void) {
        this.array.forEach(f);
    }

    get(index: number): T {
        return this.array[index];
    }

    splice(start: number, deleteCount?: number): T[] {
        return this.array.splice(start, deleteCount);
    }

    get length() {
        return this.array.length;
    }

    get empty() {
        return this.length === 0;
    }
}
