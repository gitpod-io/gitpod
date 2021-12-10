/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import * as opentracing from 'opentracing';
import { TracingConfig, initTracerFromEnv } from 'jaeger-client';
import { Sampler, SamplingDecision } from './jaeger-client-types';
import { initGlobalTracer } from 'opentracing';
import { injectable } from 'inversify';
import { ResponseError } from 'vscode-jsonrpc';
import { log, LogContext } from './logging';

export interface TraceContext {
    span?: opentracing.Span
}
export type TraceContextWithSpan = TraceContext & {
    span: opentracing.Span
}


export namespace TraceContext {
    export function startSpan(operation: string, parentCtx?: TraceContext): opentracing.Span {
        let options: opentracing.SpanOptions | undefined = undefined;
        if (parentCtx) {
            options = {
                childOf: parentCtx.span
            };
        }
        return opentracing.globalTracer().startSpan(operation, options);
    }

    export function childContext(operation: string, parentCtx: TraceContext): TraceContextWithSpan {
        const span = startSpan(operation, parentCtx);
        return { span };
    }

    export function logError(ctx: TraceContext, err: Error) {
        if (!ctx.span) {
            return;
        }

        TraceContext.addNestedTags(ctx, {
            error: {
                message: err.message,
                stacktrace: err.stack,
            },
        });
        ctx.span.setTag("error", true);
    }

    export function setJsonRPCMetadata(ctx: TraceContext, method?: string) {
        if (!ctx.span) {
            return;
        }

        const tags: { [key: string]: any } = {
            rpc: {
                system: "jsonrpc",
                //  version,
            },
        };
        if (method) {
            tags.rpc.method = method;
        }
        addNestedTags(ctx, tags);
    }

    export function logJsonRPCError(ctx: TraceContext, method: string, err: ResponseError<any>) {
        if (!ctx.span) {
            return;
        }
        // not use setError bc this is (most likely) a working operation

        setJsonRPCMetadata(ctx);
        // https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/trace/semantic_conventions/rpc.md#json-rpc
        addNestedTags(ctx, {
            rpc: {
                jsonrpc: {
                    error_code: err.code,
                    error_message: err.message,
                },
            },
        });
    }

    export function addJsonRPCParameters(ctx: TraceContext, params: { [key: string]: any }) {
        if (!ctx.span) {
            return;
        }

        setJsonRPCMetadata(ctx);
        addNestedTags(ctx, {
            rpc: {
                jsonrpc: {
                    parameters: params,
                },
            },
        });
    }

    /**
     * Does what one would expect from `span.addTags`: Calls `span.addTag` for all keys in map, recursively for objects.
     * Example:
     * ```
     * TraceContext.addNestedTags(ctx, {
     *    rpc: {
     *       system: "jsonrpc",
     *       jsonrpc: {
     *          version: "1.0",
     *          method: "test",
     *          parameters: ["abc", "def"],
     *       },
     *    },
     * });
     * ```
     * gives
     * rpc.system = "jsonrpc"
     * rpc.jsonrpc.version = "1.0"
     * rpc.jsonrpc.method = "test"
     * rpc.jsonrpc.parameters.0 = "abc"
     * rpc.jsonrpc.parameters.1 = "def"
     * @param ctx
     * @param keyValueMap
     * @returns
     */
    export function addNestedTags(ctx: TraceContext, keyValueMap: { [key: string]: any }, _namespace?: string) {
        if (!ctx.span) {
            return;
        }
        const namespace = _namespace ? `${_namespace}.` : '';

        try {
            for (const k of Object.keys(keyValueMap)) {
                const v = keyValueMap[k];
                if (v instanceof Object) {
                    addNestedTags(ctx, v, `${namespace}${k}`);
                } else {
                    ctx.span.setTag(`${namespace}${k}`, v);
                }
            }
        } catch (err) {
            // general resilience against odd shapes/parameters
            log.error("Tracing.addNestedTags", err, { namespace });
        }
    }

    export function setOWI(ctx: TraceContext, owi: LogContext) {
        if (!ctx.span) {
            return;
        }
        addNestedTags(ctx, {
            context: owi,
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
            serviceName,
        }
        const t = initTracerFromEnv(config, {
            logger: console,
            tags: {
                'service.build.commit': process.env.GITPOD_BUILD_GIT_COMMIT,
                'service.build.version': process.env.GITPOD_BUILD_VERSION,
            }
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