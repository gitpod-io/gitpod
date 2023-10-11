/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { v4 } from "uuid";

export interface RequestContext {
    contextId?: string;
    contextKind?: string;
    contextTimeMs?: number;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();
/**
 * !!! Only to be used by selected internal code !!!
 * @returns
 */
export function getGlobalContext(): RequestContext | undefined {
    return asyncLocalStorage.getStore();
}

export function runWithContext<C extends RequestContext, T>(contextKind: string, context: C, fun: () => T): T {
    return asyncLocalStorage.run(
        {
            ...context,
            contextKind,
            contextId: context.contextId || v4(),
            contextTimeMs: context.contextTimeMs || performance.now(),
        },
        fun,
    );
}

export type AsyncGeneratorDecorator<T> = (f: () => T) => T;
export function wrapAsyncGenerator<T>(
    generator: AsyncGenerator<T>,
    decorator: AsyncGeneratorDecorator<any>,
): AsyncGenerator<T> {
    return <AsyncGenerator<T>>{
        next: () => decorator(() => generator.next()),
        return: (value?: any) => decorator(() => generator.return(value)),
        throw: (e?: any) => decorator(() => generator.throw(e)),

        [Symbol.asyncIterator]() {
            return this;
        },
    };
}

export function getRequestContext(): RequestContext {
    return asyncLocalStorage.getStore() || {}; // to ease usage we hand out an empty shape here
}
