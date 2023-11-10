/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as fs from "fs";
import { filePathTelepresenceAware } from "./env";
import { DeepPartial } from "./util/deep-partial";
import { PermissionName } from "./permission";

const workspaceRegions = ["europe", "north-america", "south-america", "africa", "asia", ""] as const;
export type WorkspaceRegion = typeof workspaceRegions[number];

export function isWorkspaceRegion(s: string): s is WorkspaceRegion {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return workspaceRegions.indexOf(s as any) !== -1;
}

export interface WorkspaceCluster {
    // Name of the workspace cluster.
    // This is the string set in each
    // Must be identical to the installationShortname of the cluster it represents!
    name: string;

    // The name of the region this cluster belongs to. E.g. europe or north-america
    // The name can be at most 60 characters.
    region: WorkspaceRegion;

    // URL of the cluster's ws-manager API
    url: string;

    // TLS contains the keys and certificates necessary to use mTLS between server and clients
    tls?: TLSConfig;

    // Current state of the cluster
    state: WorkspaceClusterState;

    // Maximum value score can reach for this cluster
    maxScore: number;

    // Score used for cluster selection when starting workspace instances
    score: number;

    // True if this bridge should control this cluster
    govern: boolean;

    // An optional set of constraints that limit who can start workspaces on the cluster
    admissionConstraints?: AdmissionConstraint[];

    // The classes of workspaces that can be started on this cluster
    availableWorkspaceClasses?: WorkspaceClass[];

    // The class of workspaces that should be started on this cluster by default
    preferredWorkspaceClass?: string;
}

export namespace WorkspaceCluster {
    export function preferredWorkspaceClass(cluster: WorkspaceCluster): WorkspaceClass | undefined {
        return (cluster.availableWorkspaceClasses || []).find((c) => c.id === cluster.preferredWorkspaceClass);
    }
}

export type WorkspaceClusterState = "available" | "cordoned" | "draining";
export interface TLSConfig {
    // the CA shared between client and server (base64 encoded)
    ca: string;
    // the private key (base64 encoded)
    key: string;
    // the certificate signed with the shared CA (base64 encoded)
    crt: string;
}
export namespace TLSConfig {
    export const loadFromBase64File = (path: string): string =>
        fs.readFileSync(filePathTelepresenceAware(path)).toString("base64");
}
export type WorkspaceClusterWoTLS = Omit<WorkspaceCluster, "tls">;
export type WorkspaceManagerConnectionInfo = Pick<WorkspaceCluster, "name" | "url" | "tls">;

export type AdmissionConstraint =
    | AdmissionConstraintFeaturePreview
    | AdmissionConstraintHasPermission
    | AdmissionConstraintHasClass;
export type AdmissionConstraintFeaturePreview = { type: "has-feature-preview" };
export type AdmissionConstraintHasPermission = { type: "has-permission"; permission: PermissionName };
export type AdmissionConstraintHasClass = { type: "has-class"; id: string; displayName: string };

export namespace AdmissionConstraint {
    export function is(o: any): o is AdmissionConstraint {
        return !!o && "type" in o;
    }
    export function isHasPermissionConstraint(o: any): o is AdmissionConstraintHasPermission {
        return is(o) && o.type === "has-permission";
    }
    export function hasPermission(ac: AdmissionConstraint, permission: PermissionName): boolean {
        return isHasPermissionConstraint(ac) && ac.permission === permission;
    }
}

export interface WorkspaceClass {
    // id is a unique identifier (within the cluster) of this workspace class
    id: string;

    // The string we display to users in the UI
    displayName: string;

    // The description of this workspace class
    description: string;

    // The cost of running a workspace of this class per minute expressed in credits
    creditsPerMinute: number;
}

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
     * Lists all WorkspaceClusterWoTls for which the given predicate is true (does not return TLS for size/speed concerns)
     * @param predicate
     */
    findFiltered(predicate: WorkspaceClusterFilter): Promise<WorkspaceClusterWoTLS[]>;
}

export type WorkspaceClusterFilter = DeepPartial<
    Pick<WorkspaceCluster, "name" | "state" | "govern" | "url" | "region">
> &
    Partial<{ minScore: number }>;
