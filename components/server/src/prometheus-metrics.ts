/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as prometheusClient from "prom-client";

export function registerServerMetrics(registry: prometheusClient.Registry) {
    registry.registerMetric(loginCompletedTotal);
    registry.registerMetric(apiConnectionCounter);
    registry.registerMetric(apiConnectionClosedCounter);
    registry.registerMetric(apiCallCounter);
    registry.registerMetric(apiCallDurationHistogram);
    registry.registerMetric(httpRequestTotal);
    registry.registerMetric(httpRequestDuration);
    registry.registerMetric(gitpodVersionInfo);
    registry.registerMetric(instanceStartsSuccessTotal);
    registry.registerMetric(instanceStartsFailedTotal);
    registry.registerMetric(prebuildsStartedTotal);
    registry.registerMetric(stripeClientRequestsCompletedDurationSeconds);
    registry.registerMetric(imageBuildsStartedTotal);
    registry.registerMetric(imageBuildsCompletedTotal);
    registry.registerMetric(spicedbClientLatency);
    registry.registerMetric(jwtCookieIssued);
    registry.registerMetric(jobStartedTotal);
    registry.registerMetric(jobsCompletedTotal);
    registry.registerMetric(jobsDurationSeconds);
    registry.registerMetric(redisCacheGetLatencyHistogram);
    registry.registerMetric(redisCacheRequestsTotal);
    registry.registerMetric(redisUpdatesReceived);
    registry.registerMetric(redisUpdatesCompletedTotal);
    registry.registerMetric(updateSubscribersRegistered);
    registry.registerMetric(dbConnectionsTotal);
    registry.registerMetric(dbConnectionsFree);
    registry.registerMetric(grpcServerStarted);
    registry.registerMetric(grpcServerHandling);
    registry.registerMetric(spicedbCheckRequestsTotal);
    registry.registerMetric(authorizerSubjectId);
}

export const grpcServerStarted = new prometheusClient.Counter({
    name: "grpc_server_started_total",
    help: "Total number of RPCs started on the server.",
    labelNames: ["grpc_service", "grpc_method", "grpc_type"],
});
export const grpcServerHandled = new prometheusClient.Counter({
    name: "grpc_server_handled_total",
    help: "Total number of RPCs completed on the server, regardless of success or failure.",
    labelNames: ["grpc_service", "grpc_method", "grpc_type", "grpc_code"],
});
export const grpcServerHandling = new prometheusClient.Histogram({
    name: "grpc_server_handling_seconds",
    help: "Histogram of response latency (seconds) of gRPC that had been application-level handled by the server.",
    labelNames: ["grpc_service", "grpc_method", "grpc_type", "grpc_code"],
});

export const dbConnectionsTotal = new prometheusClient.Gauge({
    name: "gitpod_typeorm_total_connections",
    help: "Total number of connections in TypeORM pool",
});

export const dbConnectionsFree = new prometheusClient.Gauge({
    name: "gitpod_typeorm_free_connections",
    help: "Number of free connections in TypeORM pool",
});

export const dbConnectionsEnqueued = new prometheusClient.Counter({
    name: "gitpod_typeorm_enqueued_connections",
    help: "Number of times requests put on the queue, because the pool was maxed out.",
});

const loginCompletedTotal = new prometheusClient.Counter({
    name: "gitpod_login_completed_total",
    help: "Total number of logins completed into gitpod, by status",
    labelNames: ["status", "type"],
});

export function reportLoginCompleted(status: LoginCounterStatus, type: "git" | "sso") {
    loginCompletedTotal.labels(status, type).inc();
}

type LoginCounterStatus =
    // The login attempt failed due to a system error (picked up by alerts)
    | "failed"
    // The login attempt succeeded
    | "succeeded"
    // The login attempt failed, because the client failed to provide complete session information, for instance.
    | "failed_client";

const apiConnectionCounter = new prometheusClient.Counter({
    name: "gitpod_server_api_connections_total",
    help: "Total amount of established API connections",
});

export function increaseApiConnectionCounter() {
    apiConnectionCounter.inc();
}

const sessionsWithJWTs = new prometheusClient.Counter({
    name: "gitpod_server_requests_with_jwt_sessions_total",
    help: "Total amount of established API connections",
    labelNames: ["with_jwt"],
});

export function reportSessionWithJWT(containedJWT: boolean) {
    sessionsWithJWTs.inc({ with_jwt: `${containedJWT}` });
}

const jwtCookieIssued = new prometheusClient.Counter({
    name: "gitpod_server_jwt_cookie_issued_total",
    help: "Total number of JWT cookies issued for login sessions",
});

export function reportJWTCookieIssued() {
    jwtCookieIssued.inc();
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
    | "imageBuildFailedUser"
    | "scmAccessFailed"
    | "resourceExhausted"
    | "workspaceClusterMaintenance"
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

export const fgaRelationsUpdateClientLatency = new prometheusClient.Histogram({
    name: "gitpod_fga_relationship_update_seconds",
    help: "Histogram of completed relationship updates",
});

export const spicedbClientLatency = new prometheusClient.Histogram({
    name: "gitpod_spicedb_client_requests_completed_seconds",
    help: "Histogram of completed spicedb client requests",
    labelNames: ["operation", "outcome"],
});

export function observeSpicedbClientLatency(operation: string, outcome: Error | undefined, durationInSeconds: number) {
    spicedbClientLatency.observe(
        { operation, outcome: outcome === undefined ? "success" : "error" },
        durationInSeconds,
    );
}

export const jobStartedTotal = new prometheusClient.Counter({
    name: "gitpod_server_jobs_started_total",
    help: "Total number of errors caught by an error boundary in the dashboard",
    labelNames: ["name"],
});

export function reportJobStarted(name: string) {
    jobStartedTotal.inc({ name });
}

export const jobsCompletedTotal = new prometheusClient.Counter({
    name: "gitpod_server_jobs_completed_total",
    help: "Total number of errors caught by an error boundary in the dashboard",
    labelNames: ["name", "success", "unitsOfWork"],
});

export function reportJobCompleted(name: string, success: boolean, unitsOfWork?: number | undefined) {
    jobsCompletedTotal.inc({ name, success: String(success), unitsOfWork: String(unitsOfWork) });
}

export const jobsDurationSeconds = new prometheusClient.Histogram({
    name: "gitpod_server_jobs_duration_seconds",
    help: "Histogram of job duration",
    buckets: [10, 30, 60, 2 * 60, 3 * 60, 5 * 60, 10 * 60, 15 * 60],
    labelNames: ["name"],
});

// Total requests (with label on hit/miss)
export const redisCacheRequestsTotal = new prometheusClient.Counter({
    name: "gitpod_redis_cache_requests_total",
    help: "Total number of cache requests",
    labelNames: ["hit"],
});

export function reportRedisCacheRequest(hit: boolean) {
    redisCacheRequestsTotal.inc({ hit: String(hit) });
}

export const redisCacheGetLatencyHistogram = new prometheusClient.Histogram({
    name: "gitpod_redis_cache_get_latency_seconds",
    help: "Cache get latency in seconds",
    labelNames: ["cache_group"],
    buckets: [0.01, 0.1, 0.2, 0.5, 1, 2, 5, 10],
});

export const redisCacheSetLatencyHistogram = new prometheusClient.Histogram({
    name: "gitpod_redis_cache_set_latency_seconds",
    help: "Cache set latency in seconds",
    labelNames: ["cache_group"],
    buckets: [0.01, 0.1, 0.2, 0.5, 1, 2, 5, 10],
});

export const redisUpdatesReceived = new prometheusClient.Counter({
    name: "gitpod_redis_updates_received_total",
    help: "Counter of udpates recieved over Redis Pub/Sub",
    labelNames: ["channel"],
});

export function reportRedisUpdateReceived(channel: string) {
    redisUpdatesReceived.labels(channel).inc();
}

export const redisUpdatesCompletedTotal = new prometheusClient.Counter({
    name: "gitpod_redis_updates_completed_total",
    help: "Counter of udpates recieved over Redis Pub/Sub which completed",
    labelNames: ["channel", "error"],
});

export function reportRedisUpdateCompleted(channel: string, err?: Error) {
    redisUpdatesCompletedTotal.labels(channel, err ? "true" : "false").inc();
}

export const updateSubscribersRegistered = new prometheusClient.Gauge({
    name: "gitpod_server_subscribers_registered",
    help: "Gauge of subscribers registered",
    labelNames: ["type"],
});

export const guardAccessChecksTotal = new prometheusClient.Counter({
    name: "gitpod_guard_access_checks_total",
    help: "Counter for the number of guard access checks we do by type",
    labelNames: ["type"],
});

export type GuardAccessCheckType = "fga" | "resource-access" | "function-access";
export function reportGuardAccessCheck(type: GuardAccessCheckType) {
    guardAccessChecksTotal.labels(type).inc();
}

export const spicedbCheckRequestsTotal = new prometheusClient.Counter({
    name: "gitpod_spicedb_requests_check_total",
    help: "Counter for the number of check requests against SpiceDB",
    labelNames: ["consistency"],
});

export type SpiceDBCheckConsistency =
    | "minimizeLatency"
    | "atLeastAsFresh"
    | "atExactSnapshot"
    | "fullyConsistent"
    | "undefined";
export function incSpiceDBRequestsCheckTotal(consistency: SpiceDBCheckConsistency) {
    spicedbCheckRequestsTotal.labels(consistency).inc();
}

export const authorizerSubjectId = new prometheusClient.Counter({
    name: "gitpod_authorizer_subject_id_total",
    help: "Counter for the number of authorizer permission checks",
    labelNames: ["match"],
});
type AuthorizerSubjectIdMatch = "ctx-user-id-missing" | "passed-subject-id-missing" | "match" | "mismatch";
export function reportAuthorizerSubjectId(match: AuthorizerSubjectIdMatch) {
    authorizerSubjectId.labels(match).inc();
}

export const scmTokenRefreshRequestsTotal = new prometheusClient.Counter({
    name: "gitpod_scm_token_refresh_requests_total",
    help: "Counter for the number of token refresh requests we issue against SCM systems",
    labelNames: ["host", "result", "opportunisticRefresh"],
});
export type ScmTokenRefreshResult =
    | "success"
    | "timeout"
    | "error"
    | "still_valid"
    | "no_token"
    | "not_refreshable"
    | "success_after_timeout";
export type OpportunisticRefresh = "true" | "false" | "reserved";
export function reportScmTokenRefreshRequest(
    host: string,
    opportunisticRefresh: OpportunisticRefresh,
    result: ScmTokenRefreshResult,
) {
    scmTokenRefreshRequestsTotal.labels(host, result, opportunisticRefresh).inc();
}

export const scmTokenRefreshLatencyHistogram = new prometheusClient.Histogram({
    name: "gitpod_scm_token_refresh_latency_seconds",
    help: "SCM token refresh latency in seconds",
    labelNames: ["host"],
    buckets: [0.01, 0.1, 0.2, 0.5, 1, 2, 5, 10],
});
