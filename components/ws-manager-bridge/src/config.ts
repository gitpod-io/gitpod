/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


export const Configuration = Symbol("Configuration");
export interface Configuration {
    staticBridges: BridgeConfig[];

    // controllerIntervalSeconds configures how often we check for invalid workspace states
    controllerIntervalSeconds: number;

    // controllerMaxDisconnect configures how long the controller may be disconnected from ws-manager before it emits a warning
    controllerMaxDisconnectSeconds: number;

    // maxTimeToRunningPhaseSeconds is the time that we are willing to give a workspce instance in which it has to reach a running state
    maxTimeToRunningPhaseSeconds: number;
}

export interface BridgeConfig {
    installation: string;
    managerAddress: string;
}
