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
} from "@bufbuild/connect";

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
                const value = delta / 1e9;
                this.handledSecondsHistogram.labels(Object.assign(startLabels, endLabels)).observe(value);
                return value;
            };
        }
        return this.handledSecondsHistogram.startTimer(startLabels);
    }
}

const GRPCMetrics = new PrometheusClientCallMetrics();

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
                    GRPCMetrics.handled({ ...labels, code: status ? Code[status] : "OK" });
                }
            }
        }

        const labels = getLabels(req);
        GRPCMetrics.started(labels);
        const stopTimer = GRPCMetrics.startHandleTimer(labels);

        let settled = false;
        let status: Code | undefined;
        try {
            let request: UnaryRequest | StreamRequest;
            if (!req.stream) {
                request = req;
            } else {
                request = {
                    ...req,
                    message: incrementStreamMessagesCounter(
                        req.message,
                        GRPCMetrics.sent.bind(GRPCMetrics, labels),
                        false,
                    ),
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
                    message: incrementStreamMessagesCounter(
                        res.message,
                        GRPCMetrics.received.bind(GRPCMetrics, labels),
                        true,
                    ),
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
                GRPCMetrics.handled({ ...labels, code: status ? Code[status] : "OK" });
            }
        }
    };
}

export class MetricsReporter {
    private static readonly REPORT_INTERVAL = 10000;

    private intervalHandler: NodeJS.Timer | undefined;

    private readonly metricsHost: string;

    constructor(
        url: string,
        private readonly clientName: string,
    ) {
        this.metricsHost = `ide.${new URL(url).hostname}`;
    }

    startReporting() {
        if (this.intervalHandler) {
            return;
        }
        this.intervalHandler = setInterval(
            () => this.report().catch((e) => console.error("metrics: error while reporting", e)),
            MetricsReporter.REPORT_INTERVAL,
        );
    }

    private async report() {
        const metrics = await register.getMetricsAsJSON();
        register.resetMetrics();
        for (const m of metrics) {
            if (m.name === "grpc_client_msg_sent_total" || m.name === "grpc_client_msg_received_total") {
                // Skip these as thy are filtered by ide metrics
                continue;
            }

            const type = m.type as unknown as string;
            if (type === "counter") {
                await this.reportCounter(m);
            } else if (type === "histogram") {
                await this.reportHistogram(m);
            }
        }
    }

    private async reportCounter(metric: MetricObjectWithValues<MetricValue<string>>) {
        for (const { value, labels } of metric.values) {
            if (value > 0) {
                await this.addCounter(metric.name, labels as Record<string, string>, value);
            }
        }
    }

    private async reportHistogram(metric: MetricObjectWithValues<MetricValueWithName<string>>) {
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
                    await this.addHistogram(metric.name, labels as Record<string, string>, value, sum, buckets);
                }
                sum = 0;
                buckets = [];
            }
        }
    }

    stopReporting() {
        if (this.intervalHandler) {
            clearInterval(this.intervalHandler);
        }
    }

    private async addCounter(name: string, labels: Record<string, string>, value: number) {
        const data = {
            name,
            labels,
            value,
        };
        const resp = await fetch(`https://${this.metricsHost}/metrics-api/metrics/counter/add/${name}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Client": this.clientName,
            },
            body: JSON.stringify(data),
        });

        if (!resp.ok) {
            console.error(`metrics: endpoint responded with ${resp.status} ${resp.statusText}`);
        }
    }

    private async addHistogram(
        name: string,
        labels: Record<string, string>,
        count: number,
        sum: number,
        buckets: number[],
    ) {
        const data = {
            name,
            labels,
            count,
            sum,
            buckets,
        };
        const resp = await fetch(`https://${this.metricsHost}/metrics-api/metrics/histogram/add/${name}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Client": this.clientName,
            },
            body: JSON.stringify(data),
        });

        if (!resp.ok) {
            console.error("metrics: endpoint responded with", resp.status, resp.statusText);
        }
    }
}
