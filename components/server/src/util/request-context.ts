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
import { takeFirst } from "../express-util";

/**
 * RequestContext is the context that all our request-handling code runs in.
 * All code has access to the contained fields by using the exported "ctx...()" functions below.
 *
 * It's meant to be the host all concerns we have for a request. For now, those are:
 *  - authorization (via subjectId)
 *  - caching (via cache, ctxSetCache, ctxGetCache)
 *
 * It's meant to be nestable, so that we can run code in a child context with different properties.
 * The only example we have for now is "runWithSubjectId", which executes the child context with different authorization.
 * @see runWithRequestContext
 * @see runWithSubjectId
 */
export interface RequestContext {
    /**
     * Unique, artificial, backend-controlled ID for this request.
     */
    readonly requestId: string;

    /**
     * A request kind e.g. "job", "http" or "grpc".
     */
    readonly requestKind: string;

    /**
     * A name. Specific values depends on requestKind.
     */
    readonly requestMethod: string;

    /**
     * Propagate cancellation through the handler chain.
     */
    readonly signal: AbortSignal;

    /**
     * The UNIX timestamp in milliseconds when request processing started.
     */
    readonly startTime: number;

    /**
     * A cache for request-scoped data.
     */
    readonly cache: { [key: string]: any };

    /**
     * The trace ID for this request. This is used to correlate log messages and other events.
     */
    readonly traceId?: string;

    /**
     * The SubjectId this request is authenticated with.
     */
    readonly subjectId?: SubjectId;

    /**
     * Headers of this request
     */
    readonly headers?: Headers;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function ctxGet(): RequestContext {
    const ctx = asyncLocalStorage.getStore();
    if (!ctx) {
        throw new Error("ctxGet: No request context available");
    }
    return ctx;
}

export function ctxTryGet(): RequestContext | undefined {
    return asyncLocalStorage.getStore() || undefined;
}

/**
 * @returns the SubjectId this request is authenticated with, or undefined if it isn't
 */
export function ctxTrySubjectId(): SubjectId | undefined {
    const ctx = ctxTryGet();
    return ctx?.subjectId;
}

/**
 * @throws 500/INTERNAL_SERVER_ERROR if there is no userId
 * @returns The userId associated with the current request.
 */
export function ctxUserId(): string {
    const userId = ctxGet()?.subjectId?.userId();
    if (!userId) {
        throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "No userId available");
    }
    return userId;
}

/**
 * @returns The region code with current request (provided by GLB).
 */
export function ctxClientRegion(): string | undefined {
    const headers = ctxGet().headers;
    if (!headers) {
        return;
    }
    return takeFirst(headers.get("x-glb-client-region") || undefined);
}

/**
 * @throws 408/CANCELLED if the request has been aborted
 */
export function ctxCheckAborted() {
    if (ctxGet().signal.aborted) {
        throw new ApplicationError(ErrorCodes.CANCELLED, "Request aborted");
    }
}

/**
 * @throws If there is no context available
 * @returns Whether the request has been aborted
 */
export function ctxIsAborted(): boolean {
    return ctxGet().signal.aborted;
}

/**
 * @param callback Called when the request is aborted
 * @throws If there is no context available
 */
export function ctxOnAbort(callback: () => void): void {
    return ctxGet().signal.addEventListener("abort", callback);
}

/**
 * @returns The AbortSignal associated with the current request.
 */
export function ctxSignal() {
    return ctxGet().signal;
}

/** Encode cache keys in type to avoid clashes at compile time */
type CacheKey = "zedToken";
export function ctxTryGetCache<T extends Object>(key: CacheKey, d: T | undefined = undefined): T | undefined {
    return ctxTryGet()?.cache[key] || d;
}

type UpdateCache<T> = (prev: T | undefined) => T | undefined;
export function ctxTrySetCache<T extends Object>(key: CacheKey, value: T | undefined | UpdateCache<T>) {
    const cache = ctxTryGet()?.cache;
    if (!cache) {
        return;
    }

    if (typeof value === "function") {
        const prev = ctxTryGetCache<T>(key);
        value = value(prev);
    }
    cache[key] = value;
}

export type RequestContextSeed = Omit<RequestContext, "requestId" | "startTime" | "cache"> & {
    requestId?: string;
    startTime?: number;
};

/**
 * Creates a fresh context for request-handling code should run in, overwriting any prior context if present. MANDATORY for any authorization to work.
 * Uses AsyncLocalStorage under the hood, but offers a more convenient API.
 * @param context
 * @param fun
 * @returns The result of the given function
 */
export function runWithRequestContext<T>(context: RequestContextSeed, fun: () => T): T {
    const requestId = context.requestId || v4();
    const startTime = context.startTime || performance.now();
    const cache = {};
    return runWithContext({ ...context, requestId, startTime, cache }, fun);
}

/**
 * Creates a _child_ context with the given subjectId. It takes all top-level values from the parent context, and only overrides subjectId.
 * This is useful for running code with a (different) authorization than the parent context.
 * @param subjectId
 * @param fun
 * @throws If there is no parent context available
 * @returns The result of the given function
 */
export function runWithSubjectId<T>(subjectId: SubjectId | undefined, fun: () => T): T {
    const parent = ctxTryGet();
    if (!parent) {
        throw new Error("runWithChildContext: No parent context available");
    }
    return runWithContext({ ...parent, subjectId }, fun);
}

function runWithContext<C extends RequestContext, T>(context: C, fun: () => T): T {
    return asyncLocalStorage.run(context, fun);
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
