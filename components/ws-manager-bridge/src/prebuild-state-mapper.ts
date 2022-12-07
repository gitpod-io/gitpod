/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HeadlessWorkspaceEventType, PrebuiltWorkspace } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { WorkspacePhase, WorkspaceStatus } from "@gitpod/ws-manager/lib";
import { injectable } from "inversify";

export interface PrebuildUpdate {
    type: HeadlessWorkspaceEventType;
    update: Partial<PrebuiltWorkspace>;
}

@injectable()
export class PrebuildStateMapper {
    mapWorkspaceStatusToPrebuild(status: WorkspaceStatus.AsObject): PrebuildUpdate | undefined {
        if (status.phase === WorkspacePhase.STOPPED) {
            // Ideally, we'd love to hande STOPPED identical to STOPPING, because we want to assume that all conditions are stable.
            // For reliabilies sake we don't do it because experiences shows that unstable conditions are one of the most common sources of errors.
            return undefined;
        }

        if (status.phase === WorkspacePhase.STOPPING) {
            if (!!status.conditions!.timeout) {
                return {
                    type: HeadlessWorkspaceEventType.AbortedTimedOut,
                    update: {
                        state: "timeout",
                        error: status.conditions!.timeout,
                    },
                };
            } else if (!!status.conditions!.failed) {
                return {
                    type: HeadlessWorkspaceEventType.Failed,
                    update: {
                        state: "failed",
                        error: status.conditions!.failed,
                    },
                };
            } else if (!!status.conditions!.stoppedByRequest) {
                return {
                    type: HeadlessWorkspaceEventType.Aborted,
                    update: {
                        state: "aborted",
                        error: "Cancelled",
                    },
                };
            } else if (!!status.conditions!.headlessTaskFailed) {
                const result: PrebuildUpdate = {
                    type: HeadlessWorkspaceEventType.FinishedButFailed,
                    update: {
                        state: "available",
                        snapshot: status.conditions!.snapshot,
                        error: status.conditions!.headlessTaskFailed,
                    },
                };
                return result;
            } else if (!!status.conditions!.snapshot) {
                return {
                    type: HeadlessWorkspaceEventType.FinishedSuccessfully,
                    update: {
                        state: "available",
                        snapshot: status.conditions!.snapshot,
                        error: "",
                    },
                };
            } else if (!status.conditions!.snapshot) {
                // STOPPING && no snapshot is an intermediate state that we are choosing to ignore.
                return undefined;
            } else {
                log.error({ instanceId: status.id }, "unhandled prebuild status update", {
                    phase: status.phase,
                    conditions: status.phase,
                });
                return undefined;
            }
        }

        return {
            type: HeadlessWorkspaceEventType.Started,
            update: {
                state: "building",
            },
        };
    }
}
