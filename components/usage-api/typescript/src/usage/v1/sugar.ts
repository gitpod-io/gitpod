/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { UsageServiceClient } from "./usage_grpc_pb";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import * as opentracing from "opentracing";
import { Metadata } from "@grpc/grpc-js";
import { GetBilledUsageRequest, GetBilledUsageResponse } from "./usage_pb";
import { injectable, inject } from "inversify";
import * as grpc from "@grpc/grpc-js";

export const UsageServiceClientProvider = Symbol("UsageServiceClientProvider");

// UsageServiceClientProvider caches connections to UsageService
export interface UsageServiceClientProvider {
    getDefault(): PromisifiedUsageServiceClient;
}

function withTracing(ctx: TraceContext): Metadata {
    const metadata = new Metadata();
    if (ctx.span) {
        const carrier: { [key: string]: string } = {};
        opentracing.globalTracer().inject(ctx.span, opentracing.FORMAT_HTTP_HEADERS, carrier);
        Object.keys(carrier)
            .filter((p) => carrier.hasOwnProperty(p))
            .forEach((p) => metadata.set(p, carrier[p]));
    }
    return metadata;
}

export const UsageServiceClientConfig = Symbol("UsageServiceClientConfig");
export const UsageServiceClientCallMetrics = Symbol("UsageServiceClientCallMetrics");

// UsageServiceClientConfig configures the access to the UsageService
export interface UsageServiceClientConfig {
    address: string;
}

@injectable()
export class CachingUsageServiceClientProvider implements UsageServiceClientProvider {
    @inject(UsageServiceClientConfig) protected readonly clientConfig: UsageServiceClientConfig;

    // @inject(UsageServiceClientCallMetrics)
    // @optional()
    // protected readonly clientCallMetrics: IClientCallMetrics;

    // gRPC connections can be used concurrently, even across services.
    // Thus it makes sense to cache them rather than create a new connection for each request.
    protected connectionCache: PromisifiedUsageServiceClient | undefined;

    getDefault() {
        let interceptors: grpc.Interceptor[] = [];
        // if (this.clientCallMetrics) {
        //     interceptors = [createClientCallMetricsInterceptor(this.clientCallMetrics)];
        // }

        const createClient = () => {
            return new PromisifiedUsageServiceClient(
                new UsageServiceClient(this.clientConfig.address, grpc.credentials.createInsecure()),
                interceptors,
            );
        };
        let connection = this.connectionCache;
        if (!connection) {
            connection = createClient();
        } else if (!connection.isConnectionAlive()) {
            connection.dispose();

            connection = createClient();
        }

        this.connectionCache = connection;
        return connection;
    }
}

export class PromisifiedUsageServiceClient {
    constructor(public readonly client: UsageServiceClient, protected readonly interceptor: grpc.Interceptor[]) {}

    public isConnectionAlive() {
        const cs = this.client.getChannel().getConnectivityState(false);
        return (
            cs == grpc.connectivityState.CONNECTING ||
            cs == grpc.connectivityState.IDLE ||
            cs == grpc.connectivityState.READY
        );
    }

    public async getBilledUsage(_ctx: TraceContext, attributionId: string): Promise<GetBilledUsageResponse> {
        const ctx = TraceContext.childContext(`/usage-service/getBilledUsage`, _ctx);

        try {
            const req = new GetBilledUsageRequest();
            req.setAttributionId(attributionId);

            const response = await new Promise<GetBilledUsageResponse>((resolve, reject) => {
                this.client.getBilledUsage(
                    req,
                    withTracing(ctx),
                    (err: grpc.ServiceError | null, response: GetBilledUsageResponse) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(response);
                    },
                );
            });
            return response;
        } catch (err) {
            TraceContext.setError(ctx, err);
            throw err;
        } finally {
            ctx.span.finish();
        }
    }

    public dispose() {
        this.client.close();
    }

    protected getDefaultUnaryOptions(): Partial<grpc.CallOptions> {
        return {
            interceptors: this.interceptor,
        };
    }
}
