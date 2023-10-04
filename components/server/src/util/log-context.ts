/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { v4 } from "uuid";

export type LogContextOptions = LogContext & {
    contextId?: string;
    contextTimeMs?: number;
    [p: string]: any;
};

// we are installing a special augmenter that enhances the log context if executed within `runWithContext`
// with a contextId and a contextTimeMs, which denotes the amount of milliseconds since the context was created.
type EnhancedLogContext = LogContextOptions & {
    contextKind: string;
    contextId: string;
    contextTimeMs: number;
};

const asyncLocalStorage = new AsyncLocalStorage<EnhancedLogContext>();
const augmenter: LogContext.Augmenter = (ctx) => {
    const globalContext = asyncLocalStorage.getStore();
    const contextTimeMs = globalContext?.contextTimeMs ? performance.now() - globalContext.contextTimeMs : undefined;
    const result = {
        ...globalContext,
        contextTimeMs,
        ...ctx,
    };
    // if its an empty object return undefined
    return Object.keys(result).length === 0 ? undefined : result;
};
LogContext.setAugmenter(augmenter);

export function runWithContext<T>(contextKind: string, context: LogContextOptions, fun: () => T): T {
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
