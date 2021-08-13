/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceCluster } from "@gitpod/gitpod-protocol/src/workspace-cluster";
import { ClusterServiceServerOptions } from "./cluster-service-server";

export const Configuration = Symbol("Configuration");
export interface Configuration {
    // the installation this ws-manager-bridge instance is a) running in and b) controls
    installation: string;

    staticBridges: WorkspaceCluster[];

    // configures how the ClusterServiceServer is run
    clusterService: ClusterServiceServerOptions;

    // The interval in which fresh WorkspaceCluster-state is polled from the DB
    wsClusterDBReconcileIntervalSeconds: number;

    // controllerIntervalSeconds configures how often we check for invalid workspace states
    controllerIntervalSeconds: number;

    // controllerMaxDisconnect configures how long the controller may be disconnected from ws-manager before it emits a warning
    controllerMaxDisconnectSeconds: number;

    // maxTimeToRunningPhaseSeconds is the time that we are willing to give a workspce instance in which it has to reach a running state
    maxTimeToRunningPhaseSeconds: number;

    // timeouts configures the timeout behaviour of pre-workspace cluster workspaces
    timeouts: {
        metaInstanceCheckIntervalSeconds: number;
        preparingPhaseSeconds: number;
        stoppingPhaseSeconds: number;
        unknownPhaseSeconds: number;
    }
}
