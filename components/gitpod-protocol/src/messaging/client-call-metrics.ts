/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import * as prometheusClient from "prom-client";
import { IClientCallMetrics, IGrpcCallMetricsLabels, IGrpcCallMetricsLabelsWithCode } from "../util/grpc";

@injectable()
export class PrometheusClientCallMetrics implements IClientCallMetrics {
    readonly startedCounter: prometheusClient.Counter<string>;
    readonly sentCounter: prometheusClient.Counter<string>;
    readonly receivedCounter: prometheusClient.Counter<string>;
    readonly handledCounter: prometheusClient.Counter<string>;
    readonly handledSecondsHistogram: prometheusClient.Histogram<string>;

    constructor() {
        this.startedCounter = new prometheusClient.Counter({
            name: "grpc_client_started_total",
            help: "Total number of RPCs started on the client.",
            labelNames: ["grpc_service", "grpc_method", "grpc_type"],
            registers: [prometheusClient.register],
        });
        this.sentCounter = new prometheusClient.Counter({
            name: "grpc_client_msg_sent_total",
            help: " Total number of gRPC stream messages sent by the client.",
            labelNames: ["grpc_service", "grpc_method", "grpc_type"],
            registers: [prometheusClient.register],
        });
        this.receivedCounter = new prometheusClient.Counter({
            name: "grpc_client_msg_received_total",
            help: "Total number of RPC stream messages received by the client.",
            labelNames: ["grpc_service", "grpc_method", "grpc_type"],
            registers: [prometheusClient.register],
        });
        this.handledCounter = new prometheusClient.Counter({
            name: "grpc_client_handled_total",
            help: "Total number of RPCs completed by the client, regardless of success or failure.",
            labelNames: ["grpc_service", "grpc_method", "grpc_type", "grpc_code"],
            registers: [prometheusClient.register],
        });
        this.handledSecondsHistogram = new prometheusClient.Histogram({
            name: "grpc_client_handling_seconds",
            help: "Histogram of response latency (seconds) of the gRPC until it is finished by the application.",
            labelNames: ["grpc_service", "grpc_method", "grpc_type", "grpc_code"],
            registers: [prometheusClient.register],
        });
    }

    dispose(): void {
        prometheusClient.register.removeSingleMetric("grpc_client_started_total");
        prometheusClient.register.removeSingleMetric("grpc_client_msg_sent_total");
        prometheusClient.register.removeSingleMetric("grpc_client_msg_received_total");
        prometheusClient.register.removeSingleMetric("grpc_client_handled_total");
        prometheusClient.register.removeSingleMetric("grpc_client_handling_seconds");
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
        labels: IGrpcCallMetricsLabelsWithCode,
    ): (labels?: Partial<Record<string, string | number>> | undefined) => number {
        return this.handledSecondsHistogram.startTimer({
            grpc_service: labels.service,
            grpc_method: labels.method,
            grpc_type: labels.type,
        });
    }
}
