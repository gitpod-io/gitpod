/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import * as opentracing from 'opentracing';
import { TracingConfig, initTracerFromEnv, Sampler, SamplingDecision } from 'jaeger-client';
import { initGlobalTracer } from 'opentracing';
import { injectable } from 'inversify';

export interface TraceContext {
    span?: opentracing.Span
}

export namespace TraceContext {
    export function startSpan(operation: string, ctx: TraceContext): opentracing.Span {
        const options: opentracing.SpanOptions = {
            childOf: ctx.span
        }
        return opentracing.globalTracer().startSpan(operation, options);
    }

    export function startAsyncSpan(operation: string, ctx: TraceContext): opentracing.Span {
        const options: opentracing.SpanOptions = {};
        if (!!ctx.span) {
            options.references = [opentracing.followsFrom(ctx.span.context())];
        }
        return opentracing.globalTracer().startSpan(operation, options);
    }

    export function logError(ctx: TraceContext, err: Error) {
        if (!ctx.span) {
            return;
        }

        ctx.span.log({
            "error": err.message,
            "stacktrace": err.stack
        })
        ctx.span.setTag("error", true)
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
