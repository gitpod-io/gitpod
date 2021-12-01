/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import * as opentracing from 'opentracing';
import { TracingConfig, initTracerFromEnv, Sampler, SamplingDecision } from 'jaeger-client';
import { initGlobalTracer } from 'opentracing';
import { injectable } from 'inversify';
import { ResponseError } from 'vscode-jsonrpc';

export interface TraceContext {
    span?: opentracing.Span
}
export type TraceContextWithSpan = TraceContext & {
    span: opentracing.Span
}


export namespace TraceContext {
    export function startSpan(operation: string, parentCtx: TraceContext): opentracing.Span {
        const options: opentracing.SpanOptions = {
            childOf: parentCtx.span
        }
        return opentracing.globalTracer().startSpan(operation, options);
    }

    export function childContextWithSpan(operation: string, parentCtx: TraceContext): TraceContextWithSpan {
        const span = startSpan(operation, parentCtx);
        return { span };
    }

    export function startAsyncSpan(operation: string, ctx: TraceContext): opentracing.Span {
        const options: opentracing.SpanOptions = {};
        if (!!ctx.span) {
            options.references = [opentracing.followsFrom(ctx.span.context())];
        }
        return opentracing.globalTracer().startSpan(operation, options);
    }

    export function logError(ctx: TraceContext, err: Error, errorCode?: number) {
        if (!ctx.span) {
            return;
        }

        ctx.span.log({
            "error": err.message,
            "stacktrace": err.stack
        })
        ctx.span.setTag("error", true);
        if (errorCode) {
            ctx.span.setTag("errorCode", errorCode);
        }
    }

    export function logAPIError(ctx: TraceContext, err: ResponseError<any>) {
        if (!ctx.span) {
            return;
        }
        logError(ctx, err);

        ctx.span.addTags({
            errorCode: err.code,
            apiError: true,
        });
    }
}

@injectable()
export class TracingManager {

    public setup(serviceName: string, opts?: CustomTracerOpts) {
        initGlobalTracer(this.getTracerForService(serviceName, opts));
    }

    public getTracerForService(serviceName: string, opts?: CustomTracerOpts) {
        const config: TracingConfig = {
            disable: false,
            reporter: {
                logSpans: false
            },
            serviceName
        }
        const t = initTracerFromEnv(config, {
            logger: console
        });
        if (opts) {
            if (opts.perOpSampling) {
                (t as any)._sampler = new PerOperationSampler((t as any)._sampler, opts.perOpSampling);
            }
        }
        return t;
    }

}

export interface CustomTracerOpts {
    perOpSampling?: PerOperationSampling
}


// has to conform to https://github.com/jaegertracing/jaeger-client-node/blob/0042b1c0a0796bb655eb93e77ff76ab5e94c2bb6/src/_flow/sampler-thrift.js#L32
export interface PerOperationSampling {
    [key: string]: boolean
}

export class PerOperationSampler implements Sampler {
    constructor(protected readonly fallback: Sampler, protected readonly strategies: PerOperationSampling) {}

    name(): string {
        return 'PerOperationSampler';
    }

    toString(): string {
        return `${this.name()}`;
    }

    isSampled(operation: string, tags: any): boolean {
        let shouldSample = this.strategies[operation];
        if (shouldSample === undefined) {
            if (!this.fallback.isSampled) {
                return false;
            }
            return this.fallback.isSampled(operation, tags);
        }

        return shouldSample;
    }

    onCreateSpan(span: opentracing.Span): SamplingDecision {
        const outTags = {};
        const isSampled = this.isSampled((span as any).operationName, outTags);
        // NB: return retryable=true here since we can change decision after setOperationName().
        return { sample: isSampled, retryable: true, tags: outTags };
    }

    onSetOperationName(span: opentracing.Span, operationName: string): SamplingDecision {
        const outTags = {};
        const isSampled = this.isSampled((span as any).operationName, outTags);
        return { sample: isSampled, retryable: false, tags: outTags };
    }

    onSetTag(span: opentracing.Span, key: string, value: any): SamplingDecision {
        return { sample: false, retryable: true, tags: null };
    }

    equal(other: Sampler): boolean {
        return false; // TODO equal should be removed
    }

    close(callback: ()=>void): void {
        // all nested samplers are of simple types, so we do not need to Close them
        if (callback) {
            callback();
        }
    }
}

// Augment interfaces with an leading parameter "TraceContext" on every method
type IsValidArg<T> = T extends object ? keyof T extends never ? false : true : true;
type AddTraceContext<T> =
    T extends (a: infer A, b: infer B, c: infer C, d: infer D, e: infer E, f: infer F) => infer R ? (
        IsValidArg<F> extends true ? (ctx: TraceContextWithSpan, a: A, b: B, c: C, d: D, e: E, f: F) => R :
        IsValidArg<E> extends true ? (ctx: TraceContextWithSpan, a: A, b: B, c: C, d: D, e: E) => R :
        IsValidArg<D> extends true ? (ctx: TraceContextWithSpan, a: A, b: B, c: C, d: D) => R :
        IsValidArg<C> extends true ? (ctx: TraceContextWithSpan, a: A, b: B, c: C) => R :
        IsValidArg<B> extends true ? (ctx: TraceContextWithSpan, a: A, b: B) => R :
        IsValidArg<A> extends true ? (ctx: TraceContextWithSpan, a: A) => R :
        (ctx: TraceContextWithSpan) => Promise<R>
    ) : never;

export type InterfaceWithTraceContext<T> = {
    [P in keyof T]: AddTraceContext<T[P]>
};