/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { performance } from "node:perf_hooks";
import { RequestContext, getGlobalContext, runWithContext } from "./request-context";

export type LogContextOptions = LogContext & {
    [p: string]: any;
};

// we are installing a special augmenter that enhances the log context if executed within `runWithContext`
// with a contextId and a contextTimeMs, which denotes the amount of milliseconds since the context was created.
export type EnhancedLogContext = RequestContext & LogContextOptions;
const augmenter: LogContext.Augmenter = (ctx) => {
    const globalContext = getGlobalContext();
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

export function runWithLogContext<T>(contextKind: string, context: EnhancedLogContext, fun: () => T): T {
    return runWithContext<EnhancedLogContext, T>(contextKind, context, fun);
}
