/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import opentelemetry, { SpanStatusCode, Span } from "@opentelemetry/api";

/** the default tracerProvider can be reset globally, for instance during tests */
export const tracerProvider = {
    getTracer: () => opentelemetry.trace.getTracer("webapp"),
};

/**
 * @returns the currently active span
 */
export function getActiveSpan() {
    return opentelemetry.trace.getActiveSpan();
}

/**
 * Decorator for tracing a method or class.
 *
 * Span all methods of a class:
 * ```
 * @span
 * class MyClass {
 *     // ...
 * }
 * ```
 *
 * Span a single method:
 * ```
 * class MyClass {
 *   @span
 *   myMethod() {
 *      // ...
 *  }
 * }
 * ```
 */
export function span(target: any, propertyKey?: string, descriptor?: PropertyDescriptor): any {
    if (propertyKey && descriptor?.value) {
        // Method decorator logic
        const originalMethod = descriptor.value;
        descriptor.value = function (...args: any[]) {
            return createSpan(`${target.constructor.name}.${propertyKey}`, () => originalMethod.apply(context, args));
        };
        return descriptor;
    } else {
        // Class decorator logic
        for (const key of Object.getOwnPropertyNames(target.prototype)) {
            const method = target.prototype[key];
            if (key !== "constructor" && typeof method === "function") {
                const methodDescriptor = Object.getOwnPropertyDescriptor(target.prototype, key);
                if (methodDescriptor) {
                    Object.defineProperty(target.prototype, key, span(target.prototype, key, methodDescriptor));
                }
            }
        }
    }
}

/**
 * Creates a span with the given name and executes the given function.
 *
 * Example:
 * ```
 * const result = createSpan("mySpan", () => {
 *    // ...
 * });
 * ```
 */
export function createSpan<T extends Promise<T> | object>(name: string, fn: (createdSpan?: Span) => T): T {
    const tracer = tracerProvider.getTracer();
    if (!tracer) {
        return fn();
    }
    return tracer.startActiveSpan(name, (span) => {
        const handleError = (error: any) => {
            span.recordException(error);
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message,
            });
            throw error;
        };
        try {
            const result = fn(span);
            if (result instanceof Promise) {
                return result
                    .then((r) => {
                        span.end();
                        return r;
                    })
                    .catch(handleError) as T;
            }
            span.end();
            return result;
        } catch (error) {
            throw handleError(error);
        }
    });
}
