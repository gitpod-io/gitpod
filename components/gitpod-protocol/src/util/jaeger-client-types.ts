/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { opentracing } from 'jaeger-client';

// Type definitions for jaeger-client which are not exported by @types/jaeger-client
// Project: https://github.com/uber/jaeger-client-node
// Definitions by: Julian Steger <https://github.com/julianste>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

export interface TracingConfig {
    serviceName?: string;
    disable?: boolean;
    sampler?: SamplerConfig;
    reporter?: ReporterConfig;
}

export interface TracingOptions {
    reporter?: Reporter;
    metrics?: MetricsFactory;
    logger?: Logger;
    tags?: any;
}

export interface ReporterConfig {
    logSpans?: boolean;
    agentHost?: string;
    agentPort?: number;
    flushIntervalMs?: number;
}

export interface SamplerConfig {
    type: string;
    param: number;
    host?: string;
    port?: number;
    refreshIntervalMs?: number;
}

export interface Logger {
    info(msg: string): void;
    error(msg: string): void;
}

export interface Reporter {
    report(span: opentracing.Span): void;
    close(callback?: () => void): void;
    setProcess(serviceName: string, tags: any): void;
}

export interface MetricsFactory {
    createCounter(name: string, tags: any): Counter;
    createTimer(name: string, tags: any): Timer;
    createGauge(name: string, tags: any): Gauge;
}

// Counter tracks the number of times an event has occurred
export interface Counter {
    // Adds the given value to the counter.
    increment(delta: number): void;
}

// Timer tracks how long an operation took and also computes percentiles.
export interface Timer {
    // Records the time passed in.
    record(value: number): void;
}

// Gauge returns instantaneous measurements of something as an int64 value
export interface Gauge {
    // Update the gauge to the value passed in.
    update(value: number): void;
}

// export function initTracer(
//     tracingConfig: TracingConfig,
//     tracingOptions: TracingOptions,
// ): opentracing.Tracer;

// export function initTracerFromEnv(
//     tracingConfig: TracingConfig,
//     tracingOptions: TracingOptions,
// ): opentracing.Tracer;

export interface SamplingDecision {
    sample: boolean;
    retryable: boolean;
    tags: any;
}

// added by TypeFox
export interface Sampler {
    name(): string;
    isSampled(operation: string, tags: any): boolean;
    onCreateSpan(span: opentracing.Span): SamplingDecision;
    onSetOperationName(span: opentracing.Span, operationName: string): SamplingDecision;
    onSetTag(span: opentracing.Span, key: string, value: any): SamplingDecision;
    close(callback: () => void): void;
}
