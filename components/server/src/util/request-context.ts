/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { v4 } from "uuid";
import { SubjectId } from "../auth/subject-id";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

export interface RequestContext {
    readonly contextKind: string;
    readonly requestId: string;
    readonly signal: AbortSignal;
    readonly contextId: string;
    readonly contextTimeMs?: number;
    readonly subject?: {
        readonly id: SubjectId;
    };
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();
/**
 * !!! Only to be used by selected internal code !!!
 * @returns
 */
export function getGlobalContext(): RequestContext | undefined {
    return asyncLocalStorage.getStore();
}

export function getRequestContext(): RequestContext {
    const ctx = asyncLocalStorage.getStore();
    if (!ctx) {
        throw new Error("getRequestContext: No request context available");
    }
    return ctx;
}

function tryGetRequestContext(): RequestContext | undefined {
    return asyncLocalStorage.getStore() || undefined;
}

export function setSubjectId(subjectId: SubjectId): void {
    const ctx = tryGetRequestContext();
    if (!ctx) {
        throw new Error("setSubjectId: No request context available");
    }
    (ctx as any).subject = { id: subjectId };
}

export function getSubjectId(): SubjectId {
    const ctx = tryGetRequestContext();
    if (!ctx) {
        throw new Error("getSubjectId: No request context available");
    }
    const subjectId = ctx.subject?.id;
    if (!subjectId) {
        throw new ApplicationError(ErrorCodes.NOT_AUTHENTICATED, "Not authenticated");
    }
    return subjectId;
}

export function setAbortSignal(signal: AbortSignal): void {
    const ctx = tryGetRequestContext();
    if (!ctx) {
        throw new Error("setAbortSignal: No request context available");
    }
    // TODO(gpl) Should we ensure that the signal is not overwritten?
    (ctx as any).signal = signal;
}

/**
 * The context all our request-handling code should run in.
 * By default, all fields are inhereted from the parent context. Only exceptions: `requestId` and `contextId`.
 * @param subjectId If this undefined, the request is considered unauthorized
 * @param contextKind
 * @param context
 * @param fun
 * @returns
 */
export function runWithRequestContext<C extends Omit<RequestContext, "requestId" | "contextId">, T>(
    subjectId: SubjectId | undefined,
    context: C,
    fun: () => T,
): T {
    const parent = getRequestContext();
    const requestId = parent?.requestId || v4();
    const contextId = v4();
    const subject = subjectId ? { id: subjectId } : context.subject?.id;
    return runWithContext(context.contextKind, { ...context, requestId, contextId, subject }, fun);
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
