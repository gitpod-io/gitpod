/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceInstanceConditions } from "@gitpod/gitpod-protocol";
import Tooltip from "../components/Tooltip";
import { WorkspacePhase_Phase, WorkspaceStatus } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";

export function WorkspaceStatusIndicator({ status }: { status?: WorkspaceStatus }) {
    const state: WorkspacePhase_Phase = status?.phase?.name ?? WorkspacePhase_Phase.STOPPED;
    const conditions = status?.conditions;
    let stateClassName = "rounded-full w-3 h-3 text-sm align-middle";
    switch (state) {
        case WorkspacePhase_Phase.RUNNING: {
            stateClassName += " bg-green-500";
            break;
        }
        case WorkspacePhase_Phase.STOPPED: {
            if (conditions?.failed) {
                stateClassName += " bg-red-400";
            } else {
                stateClassName += " bg-gray-400";
            }
            break;
        }
        case WorkspacePhase_Phase.INTERRUPTED: {
            stateClassName += " bg-red-400";
            break;
        }
        case WorkspacePhase_Phase.UNSPECIFIED: {
            stateClassName += " bg-red-400";
            break;
        }
        default: {
            stateClassName += " bg-kumquat-ripe animate-pulse";
            break;
        }
    }
    return (
        <div className="m-auto">
            <Tooltip content={getLabel(state, conditions)}>
                <div className={stateClassName} />
            </Tooltip>
        </div>
    );
}

export function getLabel(state: WorkspacePhase_Phase, conditions?: WorkspaceInstanceConditions) {
    if (conditions?.failed) {
        return "Failed";
    }
    const phaseStr = WorkspacePhase_Phase[state];
    return phaseStr.substring(0, 1) + phaseStr.substring(1).toLocaleLowerCase();
}
