/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { DeepPartial } from "./util/deep-partial";

export interface WorkspaceCluster {
    // Name of the workspace cluster.
    // This is the string set in each 
    // Must be identical to the installationShortname of the cluster it represents!
    name: string;

    // URL of the cluster's ws-manager API
    url: string;

    // Certificate of the cluster's ws-manager API, base64 encoded
    certificate?: string;

    // Token to authenticate access to the workspace cluster
    token?: string;

    // Current state of the cluster
    state: WorkspaceClusterState;

    // Maximum value score can reach for this cluster
    maxScore: number;

    // Score used for cluster selection when starting workspace instances
    score: number;

    // If the value herein matches the short name of a fat cluster's ws-manager-bridge installation, that bridge is to control the workspace cluster.
    controller: string;
}
export type WorkspaceClusterState = "available" | "cordoned" | "draining";


export const WorkspaceClusterDB = Symbol("WorkspaceClusterDB");
export interface WorkspaceClusterDB {
    /**
     * Stores the given WorkspaceCluster to the cluster-local DB in a consistent manner.
     * If there already is an entry with the same name it's merged and updated with the given state.
     * @param cluster 
     */
    save(cluster: WorkspaceCluster): Promise<void>;

    /**
     * Deletes the cluster identified by this name, if any.
     * @param name 
     */
    deleteByName(name: string): Promise<void>;

    /**
     * Finds a WorkspaceCluster with the given name. If there is none, `undefined` is returned.
     * @param name 
     */
    findByName(name: string): Promise<WorkspaceCluster | undefined>;

    /**
     * Lists all WorkspaceCluster for which the given predicate is true
     * @param predicate 
     */
    findFiltered(predicate: DeepPartial<WorkspaceClusterFilter>): Promise<WorkspaceCluster[]>;
}
export interface WorkspaceClusterFilter extends Pick<WorkspaceCluster, "state" | "controller" | "url"> {
    minScore: number;
}