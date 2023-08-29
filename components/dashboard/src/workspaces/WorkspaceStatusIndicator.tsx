/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceInstance, WorkspaceInstanceConditions, WorkspaceInstancePhase } from "@gitpod/gitpod-protocol";
import Tooltip from "../components/Tooltip";

export function WorkspaceStatusIndicator({ instance }: { instance?: WorkspaceInstance }) {
    const state: WorkspaceInstancePhase = instance?.status?.phase || "stopped";
    const conditions = instance?.status?.conditions;
    let stateClassName = "rounded-full w-3 h-3 text-sm align-middle";
    switch (state) {
        case "running": {
            stateClassName += " bg-green-500";
            break;
        }
        case "stopped": {
            if (conditions?.failed) {
                stateClassName += " bg-red-400";
            } else {
                stateClassName += " bg-gray-400";
            }
            break;
        }
        case "interrupted": {
            stateClassName += " bg-red-400";
            break;
        }
        case "unknown": {
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

export function getLabel(state: WorkspaceInstancePhase, conditions?: WorkspaceInstanceConditions) {
    if (conditions?.failed) {
        return "Failed";
    }
    return state.substr(0, 1).toLocaleUpperCase() + state.substr(1);
}
