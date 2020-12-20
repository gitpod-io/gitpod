import * as prometheusClient from 'prom-client';

// Enable collection of default metrics.
prometheusClient.collectDefaultMetrics({ timeout: 5000 });
export const register = prometheusClient.register;

const loginCounter = new prometheusClient.Counter({
    name: 'gitpod_login_requests_total',
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