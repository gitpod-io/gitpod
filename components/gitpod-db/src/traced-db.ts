/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TraceContext, TracingManager } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { interfaces } from "inversify";
import * as opentracing from "opentracing";

export class DBWithTracing<T> {
    protected tracer: opentracing.Tracer;
    constructor(protected readonly db: any, manager: TracingManager) {
        this.tracer = manager.getTracerForService("mysql");
    }

    public trace(ctx: TraceContext): T {
        return new Proxy(this.db, {
            get: (_target: any, name: string) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                const f = Reflect.get(_target, name);
                if (!f) {
                    return undefined;
                }

                return async (...args: any[]) => {
                    // do not try and trace calls with an empty trace context - the callers intention most likely was to omit the trace
                    // so as to not spam the trace logs
                    // Also, opentracing makes some assumptions about the Span object, so this might fail under some circumstances
                    function isEmptyObject(obj: object): boolean {
                        return Object.keys(obj).length === 0;
                    }
                    if (!ctx.span || isEmptyObject(ctx.span)) {
                        return await f.bind(_target)(...args);
                    }

                    const span = this.tracer.startSpan(name, { childOf: ctx.span });
                    try {
                        return await f.bind(_target)(...args);
                    } catch (e) {
                        TraceContext.setError({ span }, e);
                        throw e;
                    } finally {
                        span.finish();
                    }
                };
            },
        });
    }
}

export function bindDbWithTracing<T>(traceKey: string | symbol, bind: interfaces.Bind, delegateKey: string | symbol) {
    return bind(traceKey).toDynamicValue((ctx) => {
        const root = ctx.container.get(delegateKey) as T;
        const tracingManager = ctx.container.get(TracingManager);
        return new DBWithTracing(root, tracingManager);
    });
}

export const TracedWorkspaceDB = Symbol("TracedWorkspaceDB");
export const TracedUserDB = Symbol("TracedUserDB");
export const TracedOneTimeSecretDB = Symbol("TracedOneTimeSecretDB");
