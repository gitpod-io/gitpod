/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { Job } from "../jobs/runner";
import { DBWithTracing, TracedWorkspaceDB, UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { durationLongerThanSeconds } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { WorkspaceStarter } from "./workspace-starter";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class WorkspaceStartController implements Job {
    public readonly name: string = "workspace-start-controller";
    public readonly frequencyMs: number = 1000 * 10; // 10s

    constructor(
        @inject(TracedWorkspaceDB) private readonly workspaceDB: DBWithTracing<WorkspaceDB>,
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(WorkspaceStarter) private readonly workspaceStarter: WorkspaceStarter,
    ) {}

    public async run(): Promise<number | undefined> {
        const span = TraceContext.startSpan("controlStartingWorkspaces");
        const ctx = { span };

        try {
            const instances = await this.workspaceDB.trace(ctx).findInstancesByPhase(WorkspaceStarter.STARTING_PHASES);
            let toReconcile = 0;
            for (const instance of instances) {
                try {
                    const phase = instance.status.phase;
                    if (
                        phase === "preparing" ||
                        phase === "building" ||
                        // !!! Note: during pending, the handover between app-cluster and ws-manager happens. !!!
                        // This means:
                        //  - there is a control loop on ws-manager-bridge that checks for an upper limit a instance may be in pending phase
                        //  - it will take some time after calling ws-manager to see the first status update
                        // In 99.9% this is due to timing, so we need to be a bit cautious here not to spam ourselves.
                        (phase === "pending" && durationLongerThanSeconds(Date.parse(instance.creationTime), 30))
                    ) {
                        // this.reconcileWorkspaceStart(ctx, instance.id);
                        const workspace = await this.workspaceDB.trace(ctx).findById(instance.workspaceId);
                        if (!workspace) {
                            throw new Error("cannot find workspace for instance");
                        }
                        const user = await this.userDB.findUserById(workspace.ownerId);
                        if (!user) {
                            throw new Error("cannot find owner for workspace");
                        }
                        toReconcile++;

                        await this.workspaceStarter.reconcileWorkspaceStart(ctx, instance.id, user, workspace);
                    }
                } catch (err) {
                    log.warn({ instanceId: instance.id }, "error while reconciling workspace start", err);
                }
            }
            return toReconcile;
        } catch (err) {
            TraceContext.setError(ctx, err);
        } finally {
            span.finish();
        }
    }
}
