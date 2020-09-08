/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from "inversify";
import { TracedWorkspaceDB, DBWithTracing, TracedUserDB } from "@gitpod/gitpod-db/lib/traced-db";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { WorkspaceInstance, WorkspaceProbeContext, RunningWorkspaceInfo } from "@gitpod/gitpod-protocol";
import * as request from "request-promise";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { URL } from "url";
import { WorkspaceFactory } from "../../../src/workspace/workspace-factory";
import { UserDB, BUILTIN_WORKSPACE_PROBE_USER_NAME } from "@gitpod/gitpod-db/lib/user-db";
import { Env } from "../../../src/env";
import { WorkspaceStarter } from "../../../src/workspace/workspace-starter";

export interface ProbeResult {
    workspaceID: string
    instanceID: string
    ok: boolean
    status?: string
    extra?: any
    probeURL?: string
}

@injectable()
export class WorkspaceHealthMonitoring {
    @inject(TracedUserDB) protected readonly userDB: DBWithTracing<UserDB>;
    @inject(TracedWorkspaceDB) protected readonly workspaceDb: DBWithTracing<WorkspaceDB>;
    @inject(Env) protected readonly env: Env;
    @inject(WorkspaceStarter) protected readonly workspaceStarter: WorkspaceStarter;
    @inject(WorkspaceFactory) protected readonly workspaceFactory: WorkspaceFactory;

    // startWorkspaceProbe creates and starts a new workspace which is independent of external services and curls a response URL as init task
    async startWorkspaceProbe(ctx: TraceContext, responseURL: string, responseToken: string): Promise<void> {
        const span = TraceContext.startSpan("startWorkspaceProbe", ctx);

        try {
            const user = await this.userDB.trace({span}).findUserByName(BUILTIN_WORKSPACE_PROBE_USER_NAME);
            if (!user) {
                throw new Error("cannot find workspace probe user. DB not set up properly?")
            }
            log.debug("Got user for workspace probe", user);

            const context: WorkspaceProbeContext = {
                title: "Workspace Probe",
                responseURL,
                responseToken,
            };

            log.debug("Created workspace probe context", context);
            const workspace = await this.workspaceFactory.createForContext({span}, user, context, "");
            await this.workspaceStarter.startWorkspace({span}, workspace, user, [], {rethrow: true});
        } catch (err) {
            TraceContext.logError({span}, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    // probeAllRunningWorkspaces tries to reach /gitpod/ready on all workspaces currently running in this region
    async probeAllRunningWorkspaces(ctx: TraceContext): Promise<ProbeResult[]> {
        const span = TraceContext.startSpan("probeAllRunningWorkspaces", ctx)

        try {
            const workspaces = await this.workspaceDb.trace({span}).findRunningInstancesWithWorkspaces(this.env.installationShortname);
            const workspacesFilter = (ws: RunningWorkspaceInfo) => !!ws.latestInstance.ideUrl && ws.latestInstance.status.phase === "running";
            const resultMapper = async (ws: RunningWorkspaceInfo) => {
                const result = await this.probeWorkspaceOnDifferentProbeURLs({ span }, ws.latestInstance);
                if (!result.ok) {
                    // double check if it is still running and not stopped already
                    const wsi = await this.workspaceDb.trace({ span }).findInstanceById(result.instanceID);
                    if (wsi && wsi.status.phase === "running") {
                        return result;
                    } else {
                        log.info({ instanceId: ws.latestInstance.id, workspaceId: ws.workspace.id }, "Workspace status phase changed during health check.");
                        return { ...result, ok: true, status: wsi && wsi.status.phase };
                    }
                } else {
                    return result;
                }
            }
            const result = workspaces.filter(workspacesFilter).map(resultMapper);
            return await Promise.all(result);
        } catch (err) {
            TraceContext.logError({span}, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected async probeWorkspaceOnDifferentProbeURLs(ctx: TraceContext, wsi: WorkspaceInstance): Promise<ProbeResult> {
        const probeURLs: URL[] = [];

        const primaryProbeURL = new URL(wsi.ideUrl);
        primaryProbeURL.pathname = "/gitpod/ready";
        probeURLs.push(primaryProbeURL);

        const fallbackProbeURL = new URL(wsi.ideUrl);
        fallbackProbeURL.pathname = "/supervisor/ready";
        probeURLs.push(fallbackProbeURL);

        let result: ProbeResult = { workspaceID: wsi.workspaceId, instanceID: wsi.id, ok: false };
        for (const probeURL of probeURLs) {
            result = { ...await this.probeWorkspace(ctx, wsi, probeURL), "probeURL": probeURL.toString() };
            if (result.ok) {
                return result;
            }
        }
        return result;
    }

    protected async probeWorkspace(ctx: TraceContext, wsi: WorkspaceInstance, probeURL: URL): Promise<ProbeResult> {
        const span = TraceContext.startSpan("probeWorkspace", ctx)

        span.setTag("instanceId", wsi.id)
        span.setTag("workspaceId", wsi.workspaceId)
        span.setTag("probeURL", probeURL.toString());

        let up = false;
        try {
            const response = await request.get(probeURL.toString(), { timeout: 5000 })
            span.log({ probeURL, response });
            up = true;
        } catch (err) {
            log.error({ instanceId: wsi.id, workspaceId: wsi.workspaceId }, "workspace health check failed", err, { "probeURL": probeURL.toString() });
            TraceContext.logError({ span }, err);
            up = false;
        } finally {
            span.finish();
        }

        return { workspaceID: wsi.workspaceId, instanceID: wsi.id, ok: up, status: wsi.status.phase, extra: wsi };
    }

}