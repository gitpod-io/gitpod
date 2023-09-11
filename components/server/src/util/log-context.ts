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
};
const asyncLocalStorage = new AsyncLocalStorage<EnhancedLogContext>();
const augmenter: LogContext.Augmenter = (ctx) => {
    const globalContext = asyncLocalStorage.getStore();
    const contextTime = globalContext?.contextTimeMs ? Date.now() - globalContext.contextTimeMs : undefined;
    return {
        ...globalContext,
        contextTime,
        ...ctx,
    };
};
LogContext.setAugmenter(augmenter);

export async function runWithContext<T>(context: LogContext, fun: () => T): Promise<T> {
    return asyncLocalStorage.run(
        {
            ...context,
            contextId: v4(),
            contextTimeMs: Date.now(),
        },
        fun,
    );
}
