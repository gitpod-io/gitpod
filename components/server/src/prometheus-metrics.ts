/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as prometheusClient from "prom-client";

export function registerServerMetrics(registry: prometheusClient.Registry) {
    registry.registerMetric(loginCounter);
    registry.registerMetric(apiConnectionCounter);
    registry.registerMetric(apiConnectionClosedCounter);
    registry.registerMetric(apiCallCounter);
    registry.registerMetric(apiCallDurationHistogram);
    registry.registerMetric(httpRequestTotal);
    registry.registerMetric(httpRequestDuration);
    registry.registerMetric(messagebusTopicReads);
    registry.registerMetric(gitpodVersionInfo);
    registry.registerMetric(instanceStartsSuccessTotal);
    registry.registerMetric(instanceStartsFailedTotal);
    registry.registerMetric(prebuildsStartedTotal);
    registry.registerMetric(stripeClientRequestsCompletedDurationSeconds);
    registry.registerMetric(imageBuildsStartedTotal);
    registry.registerMetric(imageBuildsCompletedTotal);
}

const loginCounter = new prometheusClient.Counter({
    name: "gitpod_server_login_requests_total",
    help: "Total amount of login requests",
    labelNames: ["status", "auth_host"],
});

export function increaseLoginCounter(status: string, auth_host: string) {
    loginCounter.inc({
        status,
        auth_host,
    });
}

const apiConnectionCounter = new prometheusClient.Counter({
    name: "gitpod_server_api_connections_total",
    help: "Total amount of established API connections",
});

export function increaseApiConnectionCounter() {
    apiConnectionCounter.inc();
}

const apiConnectionClosedCounter = new prometheusClient.Counter({
    name: "gitpod_server_api_connections_closed_total",
    help: "Total amount of closed API connections",
});

export function increaseApiConnectionClosedCounter() {
    apiConnectionClosedCounter.inc();
}

const apiCallCounter = new prometheusClient.Counter({
    name: "gitpod_server_api_calls_total",
    help: "Total amount of API calls per method",
    labelNames: ["method", "statusCode"],
});

export function increaseApiCallCounter(method: string, statusCode: number) {
    apiCallCounter.inc({ method, statusCode });
}

export const apiCallDurationHistogram = new prometheusClient.Histogram({
    name: "gitpod_server_api_calls_duration_seconds",
    help: "Duration of API calls in seconds",
    labelNames: ["method", "statusCode"],
    buckets: [0.1, 0.5, 1, 5, 10, 15, 30],
});

export function observeAPICallsDuration(method: string, statusCode: number, duration: number) {
    apiCallDurationHistogram.observe({ method, statusCode }, duration);
}

const httpRequestTotal = new prometheusClient.Counter({
    name: "gitpod_server_http_requests_total",
    help: "Total amount of HTTP requests per express route",
    labelNames: ["method", "route", "statusCode"],
});

export function increaseHttpRequestCounter(method: string, route: string, statusCode: number) {
    httpRequestTotal.inc({ method, route, statusCode });
}

const httpRequestDuration = new prometheusClient.Histogram({
    name: "gitpod_server_http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "statusCode"],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
});

export function observeHttpRequestDuration(
    method: string,
    route: string,
    statusCode: number,
    durationInSeconds: number,
) {
    httpRequestDuration.observe({ method, route, statusCode }, durationInSeconds);
}

const messagebusTopicReads = new prometheusClient.Counter({
    name: "gitpod_server_topic_reads_total",
    help: "The amount of reads from messagebus topics.",
    labelNames: ["topic"],
});

export function increaseMessagebusTopicReads(topic: string) {
    messagebusTopicReads.inc({
        topic,
    });
}

const gitpodVersionInfo = new prometheusClient.Gauge({
    name: "gitpod_version_info",
    help: "Gitpod's version",
    labelNames: ["gitpod_version"],
});

export function setGitpodVersion(gitpod_version: string) {
    gitpodVersionInfo.set({ gitpod_version }, 1);
}

const instanceStartsSuccessTotal = new prometheusClient.Counter({
    name: "gitpod_server_instance_starts_success_total",
    help: "Total amount of successfully performed instance starts",
    labelNames: ["retries"],
});

export function increaseSuccessfulInstanceStartCounter(retries: number = 0) {
    instanceStartsSuccessTotal.inc({ retries });
}

const instanceStartsFailedTotal = new prometheusClient.Counter({
    name: "gitpod_server_instance_starts_failed_total",
    help: "Total amount of failed performed instance starts",
    labelNames: ["reason"],
});

export type FailedInstanceStartReason =
    | "clusterSelectionFailed"
    | "startOnClusterFailed"
    | "imageBuildFailed"
    | "other";
export function increaseFailedInstanceStartCounter(reason: FailedInstanceStartReason) {
    instanceStartsFailedTotal.inc({ reason });
}

const prebuildsStartedTotal = new prometheusClient.Counter({
    name: "gitpod_prebuilds_started_total",
    help: "Counter of total prebuilds started.",
});

export function increasePrebuildsStartedCounter() {
    prebuildsStartedTotal.inc();
}

export const stripeClientRequestsCompletedDurationSeconds = new prometheusClient.Histogram({
    name: "gitpod_server_stripe_client_requests_completed_duration_seconds",
    help: "Completed stripe client requests, by outcome and operation",
    labelNames: ["operation", "outcome"],
});

export function observeStripeClientRequestsCompleted(operation: string, outcome: string, durationInSeconds: number) {
    stripeClientRequestsCompletedDurationSeconds.observe({ operation, outcome }, durationInSeconds);
}

export const imageBuildsStartedTotal = new prometheusClient.Counter({
    name: "gitpod_server_image_builds_started_total",
    help: "counter of the total number of image builds started on server",
});

export function increaseImageBuildsStartedTotal() {
    imageBuildsStartedTotal.inc();
}

export const imageBuildsCompletedTotal = new prometheusClient.Counter({
    name: "gitpod_server_image_builds_completed_total",
    help: "counter of the total number of image builds recorded as completed on server",
    labelNames: ["outcome"],
});

export function increaseImageBuildsCompletedTotal(outcome: "succeeded" | "failed") {
    imageBuildsCompletedTotal.inc({ outcome });
}
