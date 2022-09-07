/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { UsageServiceClient } from "./usage_grpc_pb";
import { BillingServiceClient } from "./billing_grpc_pb";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import * as opentracing from "opentracing";
import { Metadata } from "@grpc/grpc-js";
import { ListUsageRequest, ListUsageResponse } from "./usage_pb";
import {
    GetUpcomingInvoiceRequest,
    GetUpcomingInvoiceResponse,
    SetBilledSessionRequest,
    SetBilledSessionResponse,
    System,
} from "./billing_pb";
import { injectable, inject, optional } from "inversify";
import { createClientCallMetricsInterceptor, IClientCallMetrics } from "@gitpod/gitpod-protocol/lib/util/grpc";
import * as grpc from "@grpc/grpc-js";
import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";

export const UsageServiceClientProvider = Symbol("UsageServiceClientProvider");
export const BillingServiceClientProvider = Symbol("BillingServiceClientProvider");

// UsageServiceClientProvider caches connections to UsageService
export interface UsageServiceClientProvider {
    getDefault(): PromisifiedUsageServiceClient;
}
export interface BillingServiceClientProvider {
    getDefault(): PromisifiedBillingServiceClient;
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
export const BillingServiceClientConfig = Symbol("BillingServiceClientConfig");

export const UsageServiceClientCallMetrics = Symbol("UsageServiceClientCallMetrics");
export const BillingServiceClientCallMetrics = Symbol("BillingServiceClientCallMetrics");

// UsageServiceClientConfig configures the access to the UsageService
export interface UsageServiceClientConfig {
    address: string;
}

export interface BillingServiceClientConfig {
    address: string;
}

@injectable()
export class CachingUsageServiceClientProvider implements UsageServiceClientProvider {
    @inject(UsageServiceClientConfig) protected readonly clientConfig: UsageServiceClientConfig;

    @inject(UsageServiceClientCallMetrics)
    @optional()
    protected readonly clientCallMetrics: IClientCallMetrics;

    // gRPC connections can be used concurrently, even across services.
    // Thus it makes sense to cache them rather than create a new connection for each request.
    protected connectionCache: PromisifiedUsageServiceClient | undefined;

    getDefault() {
        let interceptors: grpc.Interceptor[] = [];
        if (this.clientCallMetrics) {
            interceptors = [createClientCallMetricsInterceptor(this.clientCallMetrics)];
        }

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

@injectable()
export class CachingBillingServiceClientProvider implements BillingServiceClientProvider {
    @inject(BillingServiceClientConfig) protected readonly billingClientConfig: BillingServiceClientConfig;

    @inject(BillingServiceClientCallMetrics)
    @optional()
    protected readonly billingClientCallMetrics: IClientCallMetrics;

    protected connectionCache: PromisifiedBillingServiceClient | undefined;

    getDefault() {
        let interceptors: grpc.Interceptor[] = [];
        if (this.billingClientCallMetrics) {
            interceptors = [createClientCallMetricsInterceptor(this.billingClientCallMetrics)];
        }

        const createClient = () => {
            return new PromisifiedBillingServiceClient(
                new BillingServiceClient(this.billingClientConfig.address, grpc.credentials.createInsecure()),
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

    public async listUsage(
        _ctx: TraceContext,
        request: ListUsageRequest,
    ): Promise<ListUsageResponse> {
        const ctx = TraceContext.childContext(`/usage-service/listUsage`, _ctx);
        try {
            const response = await new Promise<ListUsageResponse>((resolve, reject) => {
                this.client.listUsage(
                    request,
                    withTracing(ctx),
                    (err: grpc.ServiceError | null, response: ListUsageResponse) => {
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

export class PromisifiedBillingServiceClient {
    constructor(public readonly client: BillingServiceClient, protected readonly interceptor: grpc.Interceptor[]) {}

    public isConnectionAlive() {
        const cs = this.client.getChannel().getConnectivityState(false);
        return (
            cs == grpc.connectivityState.CONNECTING ||
            cs == grpc.connectivityState.IDLE ||
            cs == grpc.connectivityState.READY
        );
    }

    public async setBilledSession(instanceId: string, instanceCreationTime: Timestamp, system: System) {
        const req = new SetBilledSessionRequest();
        req.setInstanceId(instanceId);
        req.setFrom(instanceCreationTime);
        req.setSystem(system);

        const response = await new Promise<SetBilledSessionResponse>((resolve, reject) => {
            this.client.setBilledSession(req, (err: grpc.ServiceError | null, response: SetBilledSessionResponse) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(response);
            });
        });
        return response;
    }

    public dispose() {
        this.client.close();
    }

    protected getDefaultUnaryOptions(): Partial<grpc.CallOptions> {
        return {
            interceptors: this.interceptor,
        };
    }

    public async getUpcomingInvoice(attributionId: AttributionId) {
        const req = new GetUpcomingInvoiceRequest();
        if (attributionId.kind === "team") {
            req.setTeamId(attributionId.teamId);
        }
        if (attributionId.kind === "user") {
            req.setUserId(attributionId.userId);
        }

        const response = await new Promise<GetUpcomingInvoiceResponse>((resolve, reject) => {
            this.client.getUpcomingInvoice(
                req,
                (err: grpc.ServiceError | null, response: GetUpcomingInvoiceResponse) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(response);
                },
            );
        });
        return response;
    }
}
