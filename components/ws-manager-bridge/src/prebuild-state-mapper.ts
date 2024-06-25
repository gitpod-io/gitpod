/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HeadlessWorkspaceEventType, PrebuiltWorkspace } from "@gitpod/gitpod-protocol";
import { Client as ExperimentsClient } from "@gitpod/gitpod-protocol/lib/experiments/types";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TrustedValue } from "@gitpod/gitpod-protocol/lib/util/scrubbing";
import { WorkspacePhase, WorkspaceStatus } from "@gitpod/ws-manager/lib";
import { inject, injectable } from "inversify";

export interface PrebuildUpdate {
    type: HeadlessWorkspaceEventType;
    update: Partial<PrebuiltWorkspace>;
}

@injectable()
export class PrebuildStateMapper {
    constructor(
        @inject(ExperimentsClient)
        private readonly experimentsClient: ExperimentsClient,
    ) {}
    async mapWorkspaceStatusToPrebuild(status: WorkspaceStatus.AsObject): Promise<PrebuildUpdate | undefined> {
        const canUseStoppedPhase = await this.experimentsClient.getValueAsync(
            "ws_manager_bridge_stopped_prebuild_statuses",
            false,
            {},
        );
        if (!canUseStoppedPhase) {
            if (status.phase === WorkspacePhase.STOPPED) {
                return undefined;
            }
            if (status.phase !== WorkspacePhase.STOPPING) {
                return {
                    type: HeadlessWorkspaceEventType.Started,
                    update: {
                        state: "building",
                    },
                };
            }
        } else {
            if (status.phase !== WorkspacePhase.STOPPED) {
                return {
                    type: HeadlessWorkspaceEventType.Started,
                    update: {
                        state: "building",
                    },
                };
            }
        }

        if (status.conditions?.timeout) {
            return {
                type: HeadlessWorkspaceEventType.AbortedTimedOut,
                update: {
                    state: "timeout",
                    error: status.conditions.timeout,
                },
            };
        } else if (status.conditions?.failed) {
            return {
                type: HeadlessWorkspaceEventType.Failed,
                update: {
                    state: "failed",
                    error: status.conditions.failed,
                },
            };
        } else if (status.conditions?.stoppedByRequest) {
            return {
                type: HeadlessWorkspaceEventType.Aborted,
                update: {
                    state: "aborted",
                    error: "Cancelled",
                },
            };
        } else if (status.conditions?.headlessTaskFailed) {
            const result: PrebuildUpdate = {
                type: HeadlessWorkspaceEventType.FinishedButFailed,
                update: {
                    state: "available",
                    snapshot: status.conditions.snapshot,
                    error: status.conditions.headlessTaskFailed,
                },
            };
            return result;
        } else if (status.conditions?.snapshot) {
            return {
                type: HeadlessWorkspaceEventType.FinishedSuccessfully,
                update: {
                    state: "available",
                    snapshot: status.conditions.snapshot,
                    error: "",
                },
            };
        } else if (!status.conditions?.snapshot) {
            // STOPPING && no snapshot is an intermediate state that we are choosing to ignore.
            return undefined;
        }

        log.error({ instanceId: status.id }, "unhandled prebuild status update", {
            phase: status.phase,
            conditions: new TrustedValue(status.conditions).value,
        });
        return undefined;
    }
}
