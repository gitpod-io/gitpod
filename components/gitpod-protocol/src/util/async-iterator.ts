/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// Use asyncIterators with es2015
if (typeof (Symbol as any).asyncIterator === 'undefined') {
    (Symbol as any).asyncIterator = Symbol.asyncIterator || Symbol('asyncIterator');
}

export async function find<T>(it: AsyncIterableIterator<T>, predicate: (value: T) => boolean): Promise<T | undefined> {
    for await (const t of it) {
        if (predicate(t)) {
            return t;
        }
    }
    return undefined;
}
export async function filter<T>(it: AsyncIterableIterator<T>, predicate: (value: T) => boolean): Promise<T[]> {
    const result = [];
    for await (const t of it) {
        if (predicate(t)) {
            result.push(t);
        }
    }
    return result;
}

export interface AsyncCachingIterator<T> extends AsyncIterableIterator<T> {
    resetCursor(): void;
}
export class AsyncCachingIteratorImpl<T> implements AsyncIterableIterator<T>, AsyncCachingIterator<T> {

    protected cache: T[] = [];
    protected cursor = 0;
    protected cacheRead = false;

    constructor(protected readonly iterable: AsyncIterableIterator<T>) { }

    public resetCursor() {
        this.cursor = 0;
        this.cacheRead = false;
    }

    public async next(value?: any): Promise<IteratorResult<T>> {
        if (!this.cacheRead && this.cursor < this.cache.length) {
            return {
                done: false,
                value: this.cache[this.cursor++]
            };
        }
        this.cacheRead = true;

        const result = await this.iterable.next(value);
        if (!result.done) {
            this.cache.push(result.value);
        }
        return result;
    }

    [Symbol.asyncIterator]() {
        return this;
    }
}
