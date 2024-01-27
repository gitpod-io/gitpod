/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { Disposable, DisposableCollection } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { inject, injectable } from "inversify";
import { Configuration } from "./config";
import { WorkspaceInstanceController } from "./workspace-instance-controller";

/**
 * The WorkspaceInstance lifecycle is split between application clusters and workspace clusters on the transition from
 * pending/building -> starting (cmp. WorkspacePhases here:
 * https://github.com/gitpod-io/gitpod/blob/008ea3fadc89d4817cf3effc8a5b30eaf469fb1c/components/gitpod-protocol/src/workspace-instance.ts#L111).
 *
 * Before the transition, WorkspaceInstances belong to the respective app cluster, denoted by "instance.region === 'eu02'", for exmaple.
 * After a WorkspaceInstance has been moved over to a workspace cluster, that moved "ownership" is reflected in said field.
 * We maintain a constant connection (called "bridge") to all workspace clusters to be able to keep reality (workspace
 * side) in sync with what we have in our DB/forward to clients.
 *
 * This class is meant to take the same responsibility for all WorkspaceInstances that have not (yet) been passed over
 * to a workspace cluster for whatever reason. Here's a list of examples, prefixed by phase:
 *  - "preparing": failed cleanup after failed call to wsManager.StartWorkspace
 *  - "building": failed cleanup after failed image-build (which is still controlled by the application cluster,
 *     although that might change in the future)
 */
@injectable()
export class AppClusterWorkspaceInstancesController implements Disposable {
    constructor(
        @inject(Configuration) private readonly config: Configuration,
        @inject(WorkspaceDB) private readonly workspaceDb: WorkspaceDB,
        @inject(WorkspaceInstanceController)
        private readonly workspaceInstanceController: WorkspaceInstanceController,
    ) {}

    private readonly dispoables = new DisposableCollection();

    public async start() {
        const disposable = repeat(
            async () => this.controlAppClusterManagedWorkspaceInstances(),
            this.config.controllerIntervalSeconds * 1000,
        );
        this.dispoables.push(disposable);
    }

    private async controlAppClusterManagedWorkspaceInstances() {
        const appClusterInstallation = this.config.installation;

        const span = TraceContext.startSpan("controlAppClusterManagedWorkspaceInstances");
        const ctx = { span };
        try {
            log.info("Controlling app cluster instances", { installation: appClusterInstallation });

            const notStoppedInstances = await this.workspaceDb.findRunningInstancesWithWorkspaces(
                appClusterInstallation,
                undefined,
                false,
            );
            await this.workspaceInstanceController.controlNotStoppedAppClusterManagedInstanceTimeouts(
                ctx,
                notStoppedInstances,
                appClusterInstallation,
            );

            log.info("Done controlling app cluster instances", {
                installation: appClusterInstallation,
                instancesCount: notStoppedInstances.length,
            });
        } catch (err) {
            log.error("Error controlling app cluster instances", err, {
                installation: appClusterInstallation,
            });
            TraceContext.setError(ctx, err);
        } finally {
            span.finish();
        }
    }

    public dispose() {
        this.dispoables.dispose();
    }
}
