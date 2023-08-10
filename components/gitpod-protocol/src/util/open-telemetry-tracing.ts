/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { trace, SpanStatusCode, context } from "@opentelemetry/api";

export function WithSpan(...argsAsAttribute: (string | undefined)[]) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const className = target.constructor.name;

        descriptor.value = function (...args: any[]) {
            const tracer = trace.getTracer("server");
            const span = tracer.startSpan(className + "#" + propertyKey, {}, context.active());
            if (argsAsAttribute.length === 0) {
                span.setAttributes({
                    args: JSON.stringify(args),
                });
            } else {
                for (let i = 0; i < args.length; i++) {
                    const argName = argsAsAttribute[i];
                    if (argName) {
                        const arg = JSON.stringify(args[i]) || "undefined";
                        span.setAttribute(argName, arg);
                    }
                }
            }
            let result;
            try {
                result = context.with(trace.setSpan(context.active(), span), () => originalMethod.apply(this, args));
            } catch (error) {
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: error.message,
                });
                span.end();
                throw error;
            }
            if (result && typeof result.then === "function") {
                return result.then(
                    (res: any) => {
                        span.end();
                        return res;
                    },
                    (err: any) => {
                        span.setStatus({
                            code: SpanStatusCode.ERROR,
                            message: err.message,
                        });
                        span.end();
                        throw err;
                    },
                );
            } else {
                span.end();
                return result;
            }
        };

        return descriptor;
    };
}
