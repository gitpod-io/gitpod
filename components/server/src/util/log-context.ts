/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { performance } from "node:perf_hooks";
import { RequestContext, tryCtx } from "./request-context";

export type LogContextOptions = LogContext & {
    [p: string]: any;
};

function mapToLogContext(ctx: RequestContext): LogContextOptions {
    return {
        requestId: ctx.requestId,
        requestKind: ctx.requestKind,
        requestMethod: ctx.requestMethod,
        subjectId: ctx.subjectId?.toString(),
        userId: ctx.subjectId?.userId(),
        contextTimeMs: ctx?.startTime ? performance.now() - ctx.startTime : undefined,
    };
}

// we are installing a special augmenter that enhances the log context if executed within `runWithContext`
// with a contextId and a contextTimeMs, which denotes the amount of milliseconds since the context was created.
const augmenter: LogContext.Augmenter = (ctx) => {
    const requestContext = tryCtx();
    let derivedContext: LogContextOptions = {};
    if (requestContext) {
        derivedContext = mapToLogContext(requestContext);
    }
    const result = {
        ...derivedContext,
        ...ctx,
    };
    // if its an empty object return undefined
    return Object.keys(result).length === 0 ? undefined : result;
};
LogContext.setAugmenter(augmenter);
