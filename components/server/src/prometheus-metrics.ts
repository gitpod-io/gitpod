/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as prometheusClient from 'prom-client';

// Enable collection of default metrics.
prometheusClient.collectDefaultMetrics({ timeout: 5000 });
export const register = prometheusClient.register;

const loginCounter = new prometheusClient.Counter({
    name: 'gitpod_server_login_requests_total',
    help: 'Total amount of login requests',
    labelNames: ['status', 'auth_host'],
    registers: [prometheusClient.register]
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

const apiCallUserCounter = new prometheusClient.Counter({
    name: 'gitpod_server_api_calls_user_total',
    help: 'Total amount of API calls per user',
    labelNames: ['method', 'user'],
    registers: [prometheusClient.register],
});

export function increaseApiCallUserCounter(method: string, user: string) {
    apiCallUserCounter.inc({ method, user });
}
