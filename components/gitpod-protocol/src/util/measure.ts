/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { log } from "./logging";

/*
 * measure() is a decorator that can be applied to classes and methods.
 * Applying it to a class will measure the execution time of all methods of the class.
 * It measures the execution time of the decorated methods and logs it.
 */
export function measure(target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    if (typeof target === "function") {
        // target is a class
        for (const key of Object.getOwnPropertyNames(target.prototype)) {
            const desc = Object.getOwnPropertyDescriptor(target.prototype, key);
            if (desc && typeof desc.value === "function" && key !== "constructor") {
                measure(target.prototype, key, desc);
            }
        }
    } else {
        if (descriptor === undefined) {
            throw new Error("Decorator must be applied to a method or a class");
        }
        // target is an instance => propertyKey is a method
        const originalMethod = descriptor.value;
        descriptor.value = function (...args: any[]) {
            const start = Date.now();
            const result = originalMethod.apply(this, args);
            const end = Date.now();
            const duration = end - start;
            log.info(`measured call`, {
                class: target.constructor.name,
                method: propertyKey,
                duration,
            });
            return result;
        };
    }
}

export function annotateMeasurement<T extends object>(ctx: any, service: T) {
    // create and return a proxy that measures the time it takes to call a method on the service
    const handler: ProxyHandler<T> = {
        get: (target: any, prop, receiver) => {
            const origMethod = target[prop];
            if (typeof origMethod !== "function") {
                return origMethod;
            }
            return (...args: any[]) => {
                const start = Date.now();
                let result = origMethod.apply(target, args);
                function stopTime() {
                    const end = Date.now();
                    const duration = end - start;
                    if (duration > 50) {
                        log.info(`measured call`, {
                            class: target.constructor.name,
                            method: prop,
                            duration,
                        });
                    }
                }
                // if result is a promise, we need to wait for it to resolve
                if (result instanceof Promise) {
                    result = result.then((res) => stopTime());
                    return result;
                } else {
                    stopTime();
                }
                return result;
            };
        },
    };
    return new Proxy(service, handler);
}
