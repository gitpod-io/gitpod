/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { AsyncLocalStorage } from "node:async_hooks";
import { v4 } from "uuid";

// we are installing a special augmenter that enhances the log context if executed within `runWithContext`
// with a contextId and a contextTimeMs, which denotes the amount of milliseconds since the context was created.
type EnhancedLogContext = LogContext & {
    contextId?: string;
    contextTimeMs: number;
    contextKind: string;
};

const asyncLocalStorage = new AsyncLocalStorage<EnhancedLogContext>();
const augmenter: LogContext.Augmenter = (ctx) => {
    const globalContext = asyncLocalStorage.getStore();
    const contextTimeMs = globalContext?.contextTimeMs ? Date.now() - globalContext.contextTimeMs : undefined;
    const result = {
        ...globalContext,
        contextTimeMs,
        ...ctx,
    };
    // if its an empty object return undefined
    return Object.keys(result).length === 0 ? undefined : result;
};
LogContext.setAugmenter(augmenter);

export async function runWithContext<T>(
    contextKind: string,
    context: LogContext & { contextId?: string },
    fun: () => T,
): Promise<T> {
    return asyncLocalStorage.run(
        {
            ...context,
            contextKind,
            contextId: context.contextId || v4(),
            contextTimeMs: Date.now(),
        },
        fun,
    );
}
