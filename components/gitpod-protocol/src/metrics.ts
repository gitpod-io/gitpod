/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Gitpod. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * prom-client is node library, we onyl import some types and values
 * not default node metrics
 */
import type {
    Registry as PromRegistry,
    Counter as PromCounter,
    Histogram as PromHistorgram,
    MetricObjectWithValues,
    MetricValue,
    MetricValueWithName,
} from "prom-client";

const Registry: typeof PromRegistry = require("prom-client/lib/registry");
const Counter: typeof PromCounter = require("prom-client/lib/counter");
const Histogram: typeof PromHistorgram = require("prom-client/lib/histogram");

import { MethodKind } from "@bufbuild/protobuf";
import {
    StreamResponse,
    UnaryResponse,
    Code,
    ConnectError,
    Interceptor,
    StreamRequest,
    UnaryRequest,
} from "@connectrpc/connect";

type GrpcMethodType = "unary" | "client_stream" | "server_stream" | "bidi_stream";

interface IGrpcCallMetricsLabels {
    service: string;
    method: string;
    type: GrpcMethodType;
}

interface IGrpcCallMetricsLabelsWithCode extends IGrpcCallMetricsLabels {
    code: string;
}

const register = new Registry();

class PrometheusClientCallMetrics {
    readonly startedCounter: PromCounter<string>;
    readonly sentCounter: PromCounter<string>;
    readonly receivedCounter: PromCounter<string>;
    readonly handledCounter: PromCounter<string>;
    readonly handledSecondsHistogram: PromHistorgram<string>;

    readonly webSocketCounter: PromCounter<string>;

    constructor() {
        this.startedCounter = new Counter({
            name: "grpc_client_started_total",
            help: "Total number of RPCs started on the client.",
            labelNames: ["grpc_service", "grpc_method", "grpc_type"],
            registers: [register],
        });
        this.sentCounter = new Counter({
            name: "grpc_client_msg_sent_total",
            help: " Total number of gRPC stream messages sent by the client.",
            labelNames: ["grpc_service", "grpc_method", "grpc_type"],
            registers: [register],
        });
        this.receivedCounter = new Counter({
            name: "grpc_client_msg_received_total",
            help: "Total number of RPC stream messages received by the client.",
            labelNames: ["grpc_service", "grpc_method", "grpc_type"],
            registers: [register],
        });
        this.handledCounter = new Counter({
            name: "grpc_client_handled_total",
            help: "Total number of RPCs completed by the client, regardless of success or failure.",
            labelNames: ["grpc_service", "grpc_method", "grpc_type", "grpc_code"],
            registers: [register],
        });
        this.handledSecondsHistogram = new Histogram({
            name: "grpc_client_handling_seconds",
            help: "Histogram of response latency (seconds) of the gRPC until it is finished by the application.",
            labelNames: ["grpc_service", "grpc_method", "grpc_type", "grpc_code"],
            buckets: [0.1, 0.2, 0.5, 1, 2, 5, 10], // it should be aligned with https://github.com/gitpod-io/gitpod/blob/84ed1a0672d91446ba33cb7b504cfada769271a8/install/installer/pkg/components/ide-metrics/configmap.go#L315
            registers: [register],
        });

        this.webSocketCounter = new Counter({
            name: "websocket_client_total",
            help: "Total number of WebSocket connections by the client",
            labelNames: ["origin", "instance_phase", "status", "code", "was_clean"],
            registers: [register],
        });
    }

    started(labels: IGrpcCallMetricsLabels): void {
        this.startedCounter.inc({
            grpc_service: labels.service,
            grpc_method: labels.method,
            grpc_type: labels.type,
        });
    }

    sent(labels: IGrpcCallMetricsLabels): void {
        this.sentCounter.inc({
            grpc_service: labels.service,
            grpc_method: labels.method,
            grpc_type: labels.type,
        });
    }

    received(labels: IGrpcCallMetricsLabels): void {
        this.receivedCounter.inc({
            grpc_service: labels.service,
            grpc_method: labels.method,
            grpc_type: labels.type,
        });
    }

    handled(labels: IGrpcCallMetricsLabelsWithCode): void {
        this.handledCounter.inc({
            grpc_service: labels.service,
            grpc_method: labels.method,
            grpc_type: labels.type,
            grpc_code: labels.code,
        });
    }

    startHandleTimer(
        labels: IGrpcCallMetricsLabels,
    ): (endLabels?: Partial<Record<string, string | number>> | undefined) => number {
        const startLabels = {
            grpc_service: labels.service,
            grpc_method: labels.method,
            grpc_type: labels.type,
        };
        if (typeof window !== "undefined") {
            const start = performance.now();
            return (endLabels) => {
                const delta = performance.now() - start;
                const value = delta / 1000;
                this.handledSecondsHistogram.labels(Object.assign(startLabels, endLabels)).observe(value);
                return value;
            };
        }
        return this.handledSecondsHistogram.startTimer(startLabels);
    }
}

const metrics = new PrometheusClientCallMetrics();

export function getMetricsInterceptor(): Interceptor {
    const getLabels = (req: UnaryRequest | StreamRequest): IGrpcCallMetricsLabels => {
        let type: GrpcMethodType;
        switch (req.method.kind) {
            case MethodKind.Unary:
                type = "unary";
                break;
            case MethodKind.ServerStreaming:
                type = "server_stream";
                break;
            case MethodKind.ClientStreaming:
                type = "client_stream";
                break;
            case MethodKind.BiDiStreaming:
                type = "bidi_stream";
                break;
        }
        return {
            type,
            service: req.service.typeName,
            method: req.method.name,
        };
    };

    return (next) => async (req) => {
        async function* incrementStreamMessagesCounter<T>(
            iterable: AsyncIterable<T>,
            callback: () => void,
            handleMetrics: boolean,
        ): AsyncIterable<T> {
            let status: Code | undefined;
            try {
                for await (const item of iterable) {
                    callback();
                    yield item;
                }
            } catch (e) {
                const err = ConnectError.from(e);
                status = err.code;
                throw e;
            } finally {
                if (handleMetrics && !settled) {
                    stopTimer({ grpc_code: status ? Code[status] : "OK" });
                    metrics.handled({ ...labels, code: status ? Code[status] : "OK" });
                }
            }
        }

        const labels = getLabels(req);
        metrics.started(labels);
        const stopTimer = metrics.startHandleTimer(labels);

        let settled = false;
        let status: Code | undefined;
        try {
            let request: UnaryRequest | StreamRequest;
            if (!req.stream) {
                request = req;
            } else {
                request = {
                    ...req,
                    message: incrementStreamMessagesCounter(req.message, metrics.sent.bind(metrics, labels), false),
                };
            }

            const res = await next(request);

            let response: UnaryResponse | StreamResponse;
            if (!res.stream) {
                response = res;
                settled = true;
            } else {
                response = {
                    ...res,
                    message: incrementStreamMessagesCounter(res.message, metrics.received.bind(metrics, labels), true),
                };
            }

            return response;
        } catch (e) {
            settled = true;
            const err = ConnectError.from(e);
            status = err.code;
            throw e;
        } finally {
            if (settled) {
                stopTimer({ grpc_code: status ? Code[status] : "OK" });
                metrics.handled({ ...labels, code: status ? Code[status] : "OK" });
            }
        }
    };
}

export type MetricsRequest = RequestInit & { url: string };

export class MetricsReporter {
    private static readonly REPORT_INTERVAL = 10000;

    private intervalHandler: NodeJS.Timeout | undefined;

    private readonly metricsHost: string;

    private sendQueue = Promise.resolve();

    private readonly pendingRequests: MetricsRequest[] = [];

    constructor(
        private readonly options: {
            gitpodUrl: string;
            clientName: string;
            clientVersion: string;
            log: {
                error: typeof console.error;
                debug: typeof console.debug;
            };
            isEnabled?: () => Promise<boolean>;
            commonErrorDetails: { [key: string]: string | undefined };
        },
    ) {
        this.metricsHost = `ide.${new URL(options.gitpodUrl).hostname}`;
        if (typeof window !== "undefined") {
            this.options.commonErrorDetails["userAgent"] = window.navigator.userAgent;
        }
    }

    updateCommonErrorDetails(update: { [key: string]: string | undefined }) {
        Object.assign(this.options.commonErrorDetails, update);
    }

    startReporting() {
        if (this.intervalHandler) {
            return;
        }
        this.intervalHandler = setInterval(
            () => this.report().catch((e) => this.options.log.error("metrics: error while reporting", e)),
            MetricsReporter.REPORT_INTERVAL,
        );
    }

    stopReporting() {
        if (this.intervalHandler) {
            clearInterval(this.intervalHandler);
        }
    }

    private async isEnabled(): Promise<boolean> {
        if (!this.options.isEnabled) {
            return true;
        }
        return this.options.isEnabled();
    }

    private async report() {
        const enabled = await this.isEnabled();
        if (!enabled) {
            return;
        }
        if (typeof window !== undefined && !window.navigator.onLine) {
            return;
        }

        const metrics = await register.getMetricsAsJSON();
        register.resetMetrics();
        for (const m of metrics) {
            if (m.name === "grpc_client_msg_sent_total" || m.name === "grpc_client_msg_received_total") {
                // Skip these as thy are filtered by ide metrics
                continue;
            }

            const type = m.type as unknown as string;
            if (type === "counter") {
                this.syncReportCounter(m);
            } else if (type === "histogram") {
                this.syncReportHistogram(m);
            }
        }

        while (this.pendingRequests.length) {
            const request = this.pendingRequests.shift();
            if (request) {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this.send(request);
            }
        }
    }

    private syncReportCounter(metric: MetricObjectWithValues<MetricValue<string>>) {
        for (const { value, labels } of metric.values) {
            if (value > 0) {
                this.push(
                    this.create("metrics/counter/add/" + metric.name, {
                        name: metric.name,
                        labels,
                        value,
                    }),
                );
            }
        }
    }

    private syncReportHistogram(metric: MetricObjectWithValues<MetricValueWithName<string>>) {
        let sum = 0;
        let buckets: number[] = [];
        for (const { value, labels, metricName } of metric.values) {
            if (!metricName) {
                continue;
            }
            // metricName are in the following order _bucket, _sum, _count
            // We report on _count as it's the last
            // https://github.com/siimon/prom-client/blob/eee34858d2ef4198ff94f56a278d7b81f65e9c63/lib/histogram.js#L222-L235
            if (metricName.endsWith("_bucket")) {
                if (labels["le"] !== "+Inf") {
                    buckets.push(value);
                }
            } else if (metricName.endsWith("_sum")) {
                sum = value;
            } else if (metricName.endsWith("_count")) {
                if (value > 0) {
                    this.push(
                        this.create("metrics/histogram/add/" + metric.name, {
                            name: metric.name,
                            labels,
                            count: value,
                            sum,
                            buckets,
                        }),
                    );
                }
                sum = 0;
                buckets = [];
            }
        }
    }

    reportError(
        error: Error,
        data?: {
            userId?: string;
            workspaceId?: string;
            instanceId?: string;
            [key: string]: string | undefined;
        },
    ): void {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.asyncReportError(error, data);
    }

    private async asyncReportError(
        error: Error,
        data?: {
            userId?: string;
            workspaceId?: string;
            instanceId?: string;
            [key: string]: string | undefined;
        },
    ): Promise<void> {
        const enabled = await this.isEnabled();
        if (!enabled) {
            return;
        }
        const properties = { ...data, ...this.options.commonErrorDetails };
        properties["error_timestamp"] = new Date().toISOString();
        properties["error_name"] = error.name;
        properties["error_message"] = error.message;

        if (typeof window !== undefined) {
            properties["onLine"] = String(window.navigator.onLine);
        }

        const workspaceId = properties["workspaceId"];
        const instanceId = properties["instanceId"];
        const userId = properties["userId"];

        delete properties["workspaceId"];
        delete properties["instanceId"];
        delete properties["userId"];

        await this.send(
            this.create("reportError", {
                component: this.options.clientName,
                errorStack: error.stack ?? String(error),
                version: this.options.clientVersion,
                workspaceId: workspaceId ?? "",
                instanceId: instanceId ?? "",
                userId: userId ?? "",
                properties,
            }),
        );
    }

    private create(endpoint: string, data: any): MetricsRequest | undefined {
        try {
            return <MetricsRequest>{
                url: `https://${this.metricsHost}/metrics-api/` + endpoint,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Client": this.options.clientName,
                    "X-Client-Version": this.options.clientVersion,
                },
                body: JSON.stringify(data),
                credentials: "omit",
            };
        } catch (e) {
            this.options.log.error("metrics: failed to create request", e);
            return undefined;
        }
    }

    private push(request: MetricsRequest | undefined): void {
        if (!request) {
            return;
        }
        this.pendingRequests.push(request);
    }

    private async send(request: MetricsRequest | undefined): Promise<void> {
        if (!request) {
            return;
        }
        if (typeof window !== undefined && !window.navigator.onLine) {
            this.push(request);
            return;
        }
        this.sendQueue = this.sendQueue.then(async () => {
            try {
                const response = await fetch(request.url, { ...request, priority: "low" });
                if (!response.ok) {
                    this.options.log.error(
                        `metrics: endpoint responded with ${response.status} ${response.statusText}`,
                    );
                }
            } catch (e) {
                this.options.log.debug("metrics: failed to post, trying again next time", e);
                this.push(request);
            }
        });
        await this.sendQueue;
    }

    instrumentWebSocket(ws: WebSocket, origin: string) {
        const inc = (status: string, code?: number, wasClean?: boolean) => {
            metrics.webSocketCounter
                .labels({
                    origin,
                    instance_phase: this.options.commonErrorDetails["instancePhase"],
                    status,
                    code: code !== undefined ? String(code) : undefined,
                    was_clean: wasClean !== undefined ? String(Number(wasClean)) : undefined,
                })
                .inc();
        };
        inc("new");
        ws.addEventListener("open", () => inc("open"));
        ws.addEventListener("error", (event) => {
            inc("error");
            this.reportError(new Error(`WebSocket failed: ${String(event)}`));
        });
        ws.addEventListener("close", (event) => {
            inc("close", event.code, event.wasClean);
            if (!event.wasClean) {
                this.reportError(new Error("WebSocket was not closed cleanly"), {
                    code: String(event.code),
                    reason: event.reason,
                });
            }
        });
    }
}
