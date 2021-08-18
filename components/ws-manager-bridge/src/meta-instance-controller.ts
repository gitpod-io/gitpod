/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { RunningWorkspaceInfo } from "@gitpod/gitpod-protocol/lib";
import { MessageBusIntegration } from "./messagebus-integration";
import { Configuration } from "./config";

@injectable()
export class MetaInstanceController {
    @inject(Configuration)
    protected readonly config: Configuration;

    @inject(MessageBusIntegration)
    protected readonly messagebus: MessageBusIntegration;

    @inject(WorkspaceDB)
    protected readonly workspaceDB: WorkspaceDB;

    protected async checkAndStopWorkspaces() {
        const instances = await this.workspaceDB.findRunningInstancesWithWorkspaces(this.config.installation, undefined, true);

        await Promise.all(instances.map(async (instance: RunningWorkspaceInfo) => {
            const logContext = { instanceId: instance.latestInstance.id };

            try {
                const now = Date.now();
                const creationTime = new Date(instance.latestInstance.creationTime).getTime();
                const stoppingTime = new Date(instance.latestInstance.stoppingTime ?? now).getTime(); // stoppingTime only set if entered stopping state
                const timedOutInPreparing = now >= creationTime + (this.config.timeouts.preparingPhaseSeconds * 1000);
                const timedOutInStopping  = now >= stoppingTime + (this.config.timeouts.stoppingPhaseSeconds * 1000);
                const timedOutInUnknown   = now >= creationTime + (this.config.timeouts.unknownPhaseSeconds * 1000);
                const currentPhase = instance.latestInstance.status.phase;

                log.debug(logContext, 'MetaInstanceController: Checking for workspaces to stop', {
                    creationTime,
                    stoppingTime,
                    timedOutInPreparing,
                    timedOutInStopping,
                    timedOutInUnknown,
                    currentPhase
                });

                if (
                    (currentPhase === 'preparing' && timedOutInPreparing) ||
                    (currentPhase === 'stopping' && timedOutInStopping) ||
                    (currentPhase === 'unknown' && timedOutInUnknown)
                ) {
                    log.warn(logContext, 'MetaInstanceController: Setting workspace instance to stopped', {
                        creationTime,
                        currentPhase
                    });

                    const nowISO = new Date(now).toISOString();
                    instance.latestInstance.stoppingTime = nowISO;
                    instance.latestInstance.stoppedTime = nowISO;
                    instance.latestInstance.status.phase = 'stopped';

                    await this.workspaceDB.storeInstance(instance.latestInstance);
                    await this.messagebus.notifyOnInstanceUpdate({}, instance.workspace.ownerId, instance.latestInstance);
                }
            } catch (err) {
                log.error(logContext, 'MetaInstanceController: Error whilst stopping workspace instance', err);
            }
        }));
    }

    public start() {
        log.debug('MetaInstanceController: Starting interval to check for workspaces to stop', {
            interval: this.config.timeouts.metaInstanceCheckIntervalSeconds
        });

        setInterval(() => {
            this.checkAndStopWorkspaces();
        }, this.config.timeouts.metaInstanceCheckIntervalSeconds * 1000);
    }
}
