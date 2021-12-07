/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


interface CacheEntry<T> {
    key: string;
    value: T;
    expiryDate: number;
}

export class GarbageCollectedCache<T> {
    protected readonly store = new Map<string, CacheEntry<T>>();

    constructor(
        protected readonly defaultMaxAgeSeconds: number,
        protected readonly gcIntervalSeconds: number) {
        this.regularlyCollectGarbage();
    }

    public set(key: string, value: T) {
        const oldValue = this.store.get(key);
        if (oldValue) {
            // We don't want values to be cached indefinitely just because their queried often
            return;
        }
        this.store.set(key, {
            key,
            value,
            expiryDate: this.calcExpiryDate(),
        });
    }

    public get(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) {
            return undefined;
        }
        return entry.value;
    }

    public delete(key: string) {
        this.store.delete(key);
    }

    protected regularlyCollectGarbage() {
        setInterval(() => this.collectGarbage(), this.gcIntervalSeconds * 1000);
    }

    protected collectGarbage() {
        const now = Date.now();
        for (const entry of this.store.values()) {
            if (entry.expiryDate < now) {
                this.store.delete(entry.key);
            }
        }
    }

    protected calcExpiryDate(maxAgeSeconds?: number): number {
        return Date.now() + ((maxAgeSeconds || this.defaultMaxAgeSeconds) * 1000);
    }
}