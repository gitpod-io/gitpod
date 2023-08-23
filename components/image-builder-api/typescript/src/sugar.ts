/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ImageBuilderClient } from "./imgbuilder_grpc_pb";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { createClientCallMetricsInterceptor, IClientCallMetrics } from "@gitpod/gitpod-protocol/lib/util/grpc";
import * as opentracing from "opentracing";
import { Metadata } from "@grpc/grpc-js";
import {
    BuildRequest,
    BuildResponse,
    BuildStatus,
    LogsRequest,
    LogsResponse,
    ResolveWorkspaceImageResponse,
    ResolveWorkspaceImageRequest,
    ResolveBaseImageRequest,
    ResolveBaseImageResponse,
} from "./imgbuilder_pb";
import { injectable, inject, optional } from "inversify";
import * as grpc from "@grpc/grpc-js";
import { TextDecoder } from "util";
import { ImageBuildLogInfo, User, Workspace, WorkspaceInstance } from "@gitpod/gitpod-protocol";

export const ImageBuilderClientProvider = Symbol("ImageBuilderClientProvider");

// ImageBuilderClientProvider caches image builder connections
export interface ImageBuilderClientProvider {
    getClient(
        user: User,
        workspace: Workspace,
        instance?: WorkspaceInstance,
        region?: string,
    ): Promise<PromisifiedImageBuilderClient>;
}

function withTracing(ctx: TraceContext) {
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

export const ImageBuilderClientConfig = Symbol("ImageBuilderClientConfig");
export const ImageBuilderClientCallMetrics = Symbol("ImageBuilderCallMetrics");

// ImageBuilderClientConfig configures the access to an image builder
export interface ImageBuilderClientConfig {
    address: string;
}

@injectable()
export class CachingImageBuilderClientProvider implements ImageBuilderClientProvider {
    @inject(ImageBuilderClientConfig) protected readonly clientConfig: ImageBuilderClientConfig;

    @inject(ImageBuilderClientCallMetrics)
    @optional()
    protected readonly clientCallMetrics: IClientCallMetrics;

    // gRPC connections can be used concurrently, even across services.
    // Thus it makes sense to cache them rather than create a new connection for each request.
    protected connectionCache: PromisifiedImageBuilderClient | undefined;

    getDefault() {
        let interceptors: grpc.Interceptor[] = [];
        if (this.clientCallMetrics) {
            interceptors = [createClientCallMetricsInterceptor(this.clientCallMetrics)];
        }

        const createClient = () => {
            return new PromisifiedImageBuilderClient(
                new ImageBuilderClient(this.clientConfig.address, grpc.credentials.createInsecure()),
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

    async getClient(user: User, workspace: Workspace, instance?: WorkspaceInstance) {
        return this.getDefault();
    }

    promisify(c: ImageBuilderClient): PromisifiedImageBuilderClient {
        let interceptors: grpc.Interceptor[] = [];
        if (this.clientCallMetrics) {
            interceptors = [createClientCallMetricsInterceptor(this.clientCallMetrics)];
        }

        return new PromisifiedImageBuilderClient(
            new ImageBuilderClient(this.clientConfig.address, grpc.credentials.createInsecure()),
            interceptors,
        );
    }
}

// StagedBuildResponse captures the multi-stage nature (starting, running, done) of image builds.
export interface StagedBuildResponse {
    buildPromise: Promise<BuildResponse>;
    logPromise: Promise<ImageBuildLogInfo>;

    actuallyNeedsBuild: boolean;
    ref: string;
    baseRef: string;
}

export class PromisifiedImageBuilderClient {
    constructor(
        public readonly client: ImageBuilderClient,
        protected readonly interceptor: grpc.Interceptor[],
    ) {}

    public isConnectionAlive() {
        const cs = this.client.getChannel().getConnectivityState(false);
        return (
            cs == grpc.connectivityState.CONNECTING ||
            cs == grpc.connectivityState.IDLE ||
            cs == grpc.connectivityState.READY
        );
    }

    public resolveBaseImage(ctx: TraceContext, request: ResolveBaseImageRequest): Promise<ResolveBaseImageResponse> {
        return new Promise<ResolveBaseImageResponse>((resolve, reject) => {
            const span = TraceContext.startSpan(`/image-builder/resolveBaseImage`, ctx);
            this.client.resolveBaseImage(request, withTracing({ span }), this.getDefaultUnaryOptions(), (err, resp) => {
                if (err) {
                    TraceContext.setError({ span }, err);
                    reject(err);
                } else {
                    resolve(resp);
                }
                span.finish();
            });
        });
    }

    public resolveWorkspaceImage(
        ctx: TraceContext,
        request: ResolveWorkspaceImageRequest,
    ): Promise<ResolveWorkspaceImageResponse> {
        return new Promise<ResolveWorkspaceImageResponse>((resolve, reject) => {
            const span = TraceContext.startSpan(`/image-builder/resolveWorkspaceImage`, ctx);
            this.client.resolveWorkspaceImage(
                request,
                withTracing({ span }),
                this.getDefaultUnaryOptions(),
                (err, resp) => {
                    span.finish();
                    if (err) {
                        TraceContext.setError({ span }, err);
                        reject(err);
                    } else {
                        resolve(resp);
                    }
                },
            );
        });
    }

    // build returns a nested promise. The outer one resolves/rejects with the build start,
    // the inner one resolves/rejects when the build is done.
    public build(
        ctx: TraceContext,
        request: BuildRequest,
        logInfoDeferred: Deferred<ImageBuildLogInfo> = new Deferred<ImageBuildLogInfo>(),
    ): Promise<StagedBuildResponse> {
        const span = TraceContext.startSpan(`/image-builder/build`, ctx);
        const finishSpanOnce = TraceContext.finishOnce(span);

        const buildResult = new Deferred<BuildResponse>();

        const result = new Deferred<StagedBuildResponse>();
        const resultResp: StagedBuildResponse = {
            logPromise: logInfoDeferred.promise,
            buildPromise: buildResult.promise,
            actuallyNeedsBuild: true,
            ref: "unknown",
            baseRef: "unknown",
        };

        try {
            const stream = this.client.build(request, withTracing({ span }));
            stream.on("error", (err) => {
                log.debug("stream err", err);

                if (!result.isResolved) {
                    result.reject(err);
                } else {
                    buildResult.reject(err);
                    logInfoDeferred.reject(err);
                }

                TraceContext.setError({ span }, err);
                finishSpanOnce();
            });
            stream.on("data", (resp: BuildResponse) => {
                log.debug("stream resp", resp);

                if (!resultResp.ref || resultResp.ref === "unknown") {
                    resultResp.ref = resp.getRef();
                }
                if (!resultResp.baseRef || resultResp.baseRef === "unknown") {
                    resultResp.baseRef = resp.getBaseRef();
                }

                if (resp.hasInfo()) {
                    // assumes that log info stays stable for instance lifetime
                    const info = resp.getInfo();
                    if (info && info.hasLogInfo() && !logInfoDeferred.isResolved) {
                        const logInfo = info.getLogInfo()!;
                        const headers: { [key: string]: string } = {};
                        for (const [k, v] of logInfo.getHeadersMap().entries()) {
                            headers[k] = v;
                        }
                        logInfoDeferred.resolve({
                            url: logInfo.getUrl(),
                            headers,
                        });
                    }
                }

                log.info("Needs image build?", {
                    status: resp.getStatus(),
                    forceRebuild: request.getForceRebuild(),
                    triggeredBy: request.getTriggeredBy(),
                });
                if (resp.getStatus() == BuildStatus.RUNNING) {
                    resultResp.actuallyNeedsBuild = true;
                    result.resolve(resultResp);
                } else if (
                    resp.getStatus() == BuildStatus.DONE_FAILURE ||
                    resp.getStatus() == BuildStatus.DONE_SUCCESS
                ) {
                    if (!result.isResolved) {
                        resultResp.actuallyNeedsBuild = false;
                        result.resolve(resultResp);
                        buildResult.resolve(resp);
                    } else {
                        buildResult.resolve(resp);
                    }
                    if (!logInfoDeferred.isResolved) {
                        logInfoDeferred.reject(new Error("no log stream for this image build"));
                    }

                    finishSpanOnce();
                }
            });
            stream.on("end", () => {
                log.debug("stream end");

                const err = new Error("stream ended before the build did");
                let spanFinished = (result.isResolved && !resultResp.actuallyNeedsBuild) || buildResult.isResolved;
                if (!result.isResolved) {
                    result.reject(err);
                } else if (!buildResult.isResolved) {
                    buildResult.reject(err);
                }

                if (!spanFinished) {
                    TraceContext.setError({ span }, err);
                    finishSpanOnce();
                }
            });
        } catch (err) {
            TraceContext.setError({ span }, err);
            finishSpanOnce();

            log.debug("failed to start image build", request);
            log.error("failed to start image build", {
                source: request.getSource(),
                forceRebuild: request.getForceRebuild(),
                triggeredBy: request.getTriggeredBy(),
            });
            result.reject(err);
        }

        return result.promise;
    }

    // logs subscribes to build logs. This function returns when there are no more logs to provide
    public logs(ctx: TraceContext, request: LogsRequest, cb: (data: string) => "continue" | "stop"): Promise<void> {
        const span = TraceContext.startSpan(`/image-builder/logs`, ctx);

        const stream = this.client.logs(request, withTracing({ span }));
        return new Promise<void>((resolve, reject) => {
            stream.on("end", () => {
                span.finish();
                resolve();
            });
            stream.on("error", (err) => {
                TraceContext.setError({ span }, err);
                span.finish();
                reject(err);
            });
            stream.on("data", (resp: LogsResponse) => {
                if (cb(new TextDecoder("utf-8").decode(resp.getContent_asU8())) === "stop") {
                    stream.cancel();
                }
            });
        });
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
