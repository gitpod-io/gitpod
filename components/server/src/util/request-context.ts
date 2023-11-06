/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { v4 } from "uuid";
import { SubjectId } from "../auth/subject-id";
import { IAnalyticsWriter, IdentifyMessage, PageMessage, TrackMessage } from "@gitpod/gitpod-protocol/lib/analytics";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

export interface RequestContext {
    /**
     * Unique, artificial ID for this request.
     */
    readonly requestId: string;

    /** A request kind e.g. "job", "http" or "grpc" */
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

    /** The SubjectId this request is authenticated with. */
    readonly subjectId?: SubjectId;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function ctx(): RequestContext {
    const ctx = asyncLocalStorage.getStore();
    if (!ctx) {
        throw new Error("getRequestContext: No request context available");
    }
    return ctx;
}

export function tryCtx(): RequestContext | undefined {
    return asyncLocalStorage.getStore() || undefined;
}

/**
 * @deprecated Only used during the rollout period. Use `getSubjectId` instead
 */
export function tryGetSubjectId(): SubjectId | undefined {
    const ctx = tryCtx();
    return ctx?.subjectId;
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
export function runWithRequestContext<T>(
    context: Omit<RequestContext, "requestId" | "startTime"> & { requestId?: string; startTime?: number },
    fun: () => T,
): T {
    const requestId = context.requestId || v4();
    const startTime = context.startTime || performance.now();
    return runWithContext({ ...context, requestId, startTime }, fun);
}

export function runWithChildContext<T>(child: Pick<RequestContext, "subjectId">, fun: () => T): T {
    const parent = ctx();
    if (!parent) {
        throw new Error("runWithChildContext: No parent context available");
    }
    // TODO(gpl) Here we'll want to create a new spanID for tracing
    return runWithContext({ ...child, ...parent }, fun);
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

export class ContextAwareAnalyticsWriter implements IAnalyticsWriter {
    constructor(readonly writer: IAnalyticsWriter) {}

    identify(msg: IdentifyMessage): void {}

    track(msg: TrackMessage): void {}

    page(msg: PageMessage): void {
        const traceIds = this.getTraceIds();
        this.writer.page({
            ...msg,
            userId: msg.userId || traceIds.userId,
            subjectId: msg.subjectId || traceIds.subjectId,
        });
    }

    private getTraceIds(): { userId?: string; subjectId?: string } {
        const subjectId = ctx().subjectId;
        if (!subjectId) {
            return {};
        }
        return {
            userId: subjectId.userId(),
            subjectId: subjectId.toString(),
        };
    }
}

/**
 * @deprecated This function is meant to be used during the transition from the current style, first argument-based authorization, to authorization based on the SubjectId passed in the RequestContext. it's purpose is primarily to a) make sure we can split up work into smaller pieces, and b) make it easier to remove afterwards.
 * @returns
 */
export function userId(): string {
    const userId = ctx().subjectId?.userId();
    if (!userId) {
        throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "No userId available");
    }
    return userId;
}
