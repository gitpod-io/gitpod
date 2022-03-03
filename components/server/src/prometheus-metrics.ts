/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as prometheusClient from 'prom-client';

// Enable collection of default metrics.
prometheusClient.collectDefaultMetrics();
export const register = prometheusClient.register;

const loginCounter = new prometheusClient.Counter({
    name: 'gitpod_server_login_requests_total',
    help: 'Total amount of login requests',
    labelNames: ['status', 'auth_host'],
    registers: [prometheusClient.register],
});

export function increaseLoginCounter(status: string, auth_host: string) {
    loginCounter.inc({
        status,
        auth_host,
    });
}

const apiConnectionCounter = new prometheusClient.Counter({
    name: 'gitpod_server_api_connections_total',
    help: 'Total amount of established API connections',
    registers: [prometheusClient.register],
});

export function increaseApiConnectionCounter() {
    apiConnectionCounter.inc();
}

const apiConnectionClosedCounter = new prometheusClient.Counter({
    name: 'gitpod_server_api_connections_closed_total',
    help: 'Total amount of closed API connections',
    registers: [prometheusClient.register],
});

export function increaseApiConnectionClosedCounter() {
    apiConnectionClosedCounter.inc();
}

const apiCallCounter = new prometheusClient.Counter({
    name: 'gitpod_server_api_calls_total',
    help: 'Total amount of API calls per method',
    labelNames: ['method', 'statusCode'],
    registers: [prometheusClient.register],
});

export function increaseApiCallCounter(method: string, statusCode: number) {
    apiCallCounter.inc({ method, statusCode });
}

export const apiCallDurationHistogram = new prometheusClient.Histogram({
    name: 'gitpod_server_api_calls_duration_seconds',
    help: 'Duration of API calls in seconds',
    labelNames: ['method'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
    registers: [prometheusClient.register],
});

export function observeAPICallsDuration(method: string, duration: number) {
    apiCallDurationHistogram.observe({ method }, duration);
}

const apiCallUserCounter = new prometheusClient.Counter({
    name: 'gitpod_server_api_calls_user_total',
    help: 'Total amount of API calls per user',
    labelNames: ['method', 'user'],
    registers: [prometheusClient.register],
});

export function increaseApiCallUserCounter(method: string, user: string) {
    apiCallUserCounter.inc({ method, user });
}

const httpRequestTotal = new prometheusClient.Counter({
    name: 'gitpod_server_http_requests_total',
    help: 'Total amount of HTTP requests per express route',
    labelNames: ['method', 'route', 'statusCode'],
    registers: [prometheusClient.register],
});

export function increaseHttpRequestCounter(method: string, route: string, statusCode: number) {
    httpRequestTotal.inc({ method, route, statusCode });
}

const httpRequestDuration = new prometheusClient.Histogram({
    name: 'gitpod_server_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'statusCode'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
    registers: [prometheusClient.register],
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
    name: 'gitpod_server_topic_reads_total',
    help: 'The amount of reads from messagebus topics.',
    labelNames: ['topic'],
    registers: [prometheusClient.register],
});

export function increaseMessagebusTopicReads(topic: string) {
    messagebusTopicReads.inc({
        topic,
    });
}

const gitpodVersionInfo = new prometheusClient.Gauge({
    name: 'gitpod_version_info',
    help: "Gitpod's version",
    labelNames: ['gitpod_version'],
    registers: [prometheusClient.register],
});

export function setGitpodVersion(gitpod_version: string) {
    gitpodVersionInfo.set({ gitpod_version }, 1);
}
