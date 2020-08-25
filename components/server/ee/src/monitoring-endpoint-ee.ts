/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as express from 'express';
import * as prometheusClient from 'prom-client';
import { WorkspaceHealthMonitoring } from './workspace/workspace-health-monitoring';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import * as request from 'request';
import { Span } from 'opentracing';
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { injectable, inject } from 'inversify';

@injectable()
export class MonitoringEndpointsAppEE extends WorkspaceHealthMonitoring {
    @inject(WorkspaceHealthMonitoring) protected readonly workspaceHealthMonitoring: WorkspaceHealthMonitoring;

    public create(): express.Application {
        const monApp = express();
        prometheusClient.collectDefaultMetrics({ timeout: 5000 });

        monApp.get('/metrics', (_, res) => {
            res.send(prometheusClient.register.metrics().toString());
        });

        monApp.post('/server-health', async (req, res) => {
            const span = TraceContext.startSpan("/server-health", {});
            try {
                const { responseUrl, token } = extractCercHeader(req, res, span);
                if (!responseUrl || !token) {
                    return;
                }
                const result = { serverStatus: "ok" };
                postResultToCerc({ span }, req.path, responseUrl, token, result);
                res.status(200).send("ok");
            } catch (err) {
                log.error('unexpected error during handling of POST /server-health', err);
                TraceContext.logError({ span }, err);
                res.status(500).send(err);
            } finally {
                span.finish();
            }
        });

        monApp.get('/workspace-health', async (req, res) => {
            try {
                const result = await checkWorkspaceHealth({}, this.workspaceHealthMonitoring, !!req.query.extra);
                if (result.unhealthy > 0) {
                    console.warn("not all workspaces are healthy", result);
                    res.status(406).send(result);
                } else {
                    res.status(200).send(result);
                }
            } catch (err) {
                log.error("failed to check workspace health", err);
                res.status(500).send(err);
            }
        });

        monApp.post('/workspace-health', async (req, res) => {
            const span = TraceContext.startSpan("/workspace-health", {});
            try {
                const { responseUrl, token } = extractCercHeader(req, res, span);
                if (!responseUrl || !token) {
                    return;
                }
                checkWorkspaceHealth({ span }, this.workspaceHealthMonitoring, !!req.query.extra).then(result => {
                    const responseURLWithResult = `${responseUrl}?result=${result.unhealthy > 0 ? 'failure' : 'success'}`;
                    postResultToCerc({ span }, req.path, responseURLWithResult, token, result);
                });
                res.status(200).send("ok");
            } catch (err) {
                log.error('unexpected error during handling of POST /workspace-health', err);
                TraceContext.logError({ span }, err);
                res.status(500).send(err);
            } finally {
                span.finish();
            }
        });

        monApp.post('/workspace-probe', async (req, res) => {
            const span = TraceContext.startSpan("/workspace-probe", {});
            try {
                const { responseUrl, token } = extractCercHeader(req, res, span);
                if (!responseUrl || !token) {
                    return;
                }
                await this.workspaceHealthMonitoring.startWorkspaceProbe({ span }, responseUrl, token);
                res.status(200).send("ok");
            } catch (err) {
                log.error('unexpected error during handling of POST /workspace-probe', err);
                TraceContext.logError({ span }, err);
                res.status(500).send(err);
            } finally {
                span.finish();
            }
        });

        return monApp;
    }
}

function postResultToCerc(ctx: TraceContext, requestPath: string, responseUrl: string, token: string, result: {}) {
    const span = TraceContext.startSpan("postResultToCerc", ctx);
    span.addTags({ requestPath, responseUrl, token });
    span.log(result);
    request.post(responseUrl, {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
        auth: { user: "Bearer", pass: token }
    }, (error, response, body) => {
        if (error) {
            log.error('could not post result to cerc', error, { requestPath, responseUrl });
            TraceContext.logError({ span }, error);
        }
        if (response && response.statusCode != 200) {
            const error = new Error(`status code not 200 (OK) but ${response.statusCode} (body: ${body})`);
            log.error('could not post result to cerc', error, { requestPath, responseUrl });
            TraceContext.logError({ span }, error);
        }
        span.finish();
    });
}

async function checkWorkspaceHealth(ctx: TraceContext, workspaceHealthMonitoring: WorkspaceHealthMonitoring, extra: boolean = false, ) {
    const span = TraceContext.startSpan("checkWorkspaceHealth", ctx);
    const result = await workspaceHealthMonitoring.probeAllRunningWorkspaces({ span });
    const numUnhealthy = result.map(r => r.ok ? 0 : 1).reduce((acc: number, cur: number) => acc + cur as number, 0);
    let returnValue = {
        status: numUnhealthy > 0 ? (numUnhealthy == result.length ? 'unhealthy' : 'partially healthy') : 'fully healthy',
        healthy: result.length - numUnhealthy,
        unhealthy: numUnhealthy,
        total: result.length,
        timestamp: Date.now()
    };
    if (extra && numUnhealthy > 0) {
        return {
            ...returnValue, extra: {
                unhealthyWorkspaces: result.filter(r => !r.ok),
                notRunningWorkspaces: result.filter(r => r.status !== "running")
            }
        }
    }
    span.finish();
    return returnValue;
}

function extractCercHeader(req: express.Request, res: express.Response, span: Span): { responseUrl: string | undefined, token: string | undefined } {
    const responseUrl = req.header("X-Cerc-URL");
    if (!responseUrl) {
        log.warn("X-Cerc-URL header missing", { requestPath: req.path });
        res.status(406).send("missing X-Cerc-URL header");
    }

    const token = req.header("X-Cerc-Token");
    if (!token) {
        log.warn("X-Cerc-Token header missing", { requestPath: req.path });
        res.status(401).send("missing X-Cerc-Token header");
    }

    span.setTag("token", token);
    span.setTag("responseURL", responseUrl);
    return { responseUrl, token };
}
