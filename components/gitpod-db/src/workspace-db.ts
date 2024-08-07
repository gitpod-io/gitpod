/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DeepPartial } from "typeorm";

import {
    Workspace,
    WorkspaceInfo,
    WorkspaceInstance,
    WorkspaceInstanceUser,
    Snapshot,
    PrebuiltWorkspace,
    PrebuiltWorkspaceUpdatable,
    RunningWorkspaceInfo,
    WorkspaceAndInstance,
    WorkspaceType,
    PrebuildInfo,
    AdminGetWorkspacesQuery,
    SnapshotState,
    WorkspaceSession,
    PrebuiltWorkspaceWithWorkspace,
    PrebuildWithStatus,
} from "@gitpod/gitpod-protocol";

export type MaybeWorkspace = Workspace | undefined;
export type MaybeWorkspaceInstance = WorkspaceInstance | undefined;

export interface FindWorkspacesOptions {
    userId: string;
    organizationId?: string;
    projectId?: string | string[];
    includeWithoutProject?: boolean;
    limit?: number;
    searchString?: string;
    includeHeadless?: boolean;
    pinnedOnly?: boolean;
}

export interface PrebuiltUpdatableAndWorkspace extends PrebuiltWorkspaceUpdatable {
    prebuild: PrebuiltWorkspace;
    workspace: Workspace;
}

export type WorkspaceAuthData = Pick<Workspace, "id" | "ownerId" | "shareable">;
export type WorkspaceInstancePortsAuthData = Pick<WorkspaceInstance, "id" | "region">;
export interface WorkspacePortsAuthData {
    instance: WorkspaceInstancePortsAuthData;
    workspace: WorkspaceAuthData;
}

export interface PrebuildWithWorkspace {
    prebuild: PrebuiltWorkspace;
    workspace: Workspace;
}

export interface PrebuildWithWorkspaceAndInstances {
    prebuild: PrebuiltWorkspace;
    workspace: Workspace;
    instances: WorkspaceInstance[];
}

export type WorkspaceAndOwner = Pick<Workspace, "id" | "ownerId">;
export type WorkspaceOwnerAndSoftDeleted = Pick<Workspace, "id" | "ownerId" | "softDeleted">;

export const WorkspaceDB = Symbol("WorkspaceDB");
export interface WorkspaceDB {
    connect(maxTries: number, timeout: number): Promise<void>;

    transaction<T>(code: (db: WorkspaceDB) => Promise<T>): Promise<T>;

    store(workspace: Workspace): Promise<Workspace>;
    updatePartial(workspaceId: string, partial: DeepPartial<Workspace>): Promise<void>;
    findById(id: string): Promise<MaybeWorkspace>;
    findByInstanceId(id: string): Promise<MaybeWorkspace>;
    find(options: FindWorkspacesOptions): Promise<WorkspaceInfo[]>;
    findWorkspacePortsAuthDataById(workspaceId: string): Promise<WorkspacePortsAuthData | undefined>;

    storeInstance(instance: WorkspaceInstance): Promise<WorkspaceInstance>;

    // Partial update: unconditional, single field updates. Enclose in a transaction if necessary
    updateLastHeartbeat(instanceId: string, userId: string, newHeartbeat: Date, wasClosed?: boolean): Promise<void>;
    getLastOwnerHeartbeatFor(instance: WorkspaceInstance): Promise<{ lastSeen: Date; wasClosed?: boolean } | undefined>;
    getWorkspaceUsers(workspaceId: string, minLastSeen: number): Promise<WorkspaceInstanceUser[]>;
    updateInstancePartial(instanceId: string, partial: DeepPartial<WorkspaceInstance>): Promise<WorkspaceInstance>;

    findInstanceById(workspaceInstanceId: string): Promise<MaybeWorkspaceInstance>;
    findInstances(workspaceId: string): Promise<WorkspaceInstance[]>;
    findWorkspacesByUser(userId: string): Promise<Workspace[]>;
    findCurrentInstance(workspaceId: string): Promise<MaybeWorkspaceInstance>;
    findRunningInstance(workspaceId: string): Promise<MaybeWorkspaceInstance>;
    findSessionsInPeriod(
        organizationId: string,
        periodStart: Date,
        periodEnd: Date,
        limit: number,
        offset: number,
    ): Promise<WorkspaceSession[]>;
    findEligibleWorkspacesForSoftDeletion(
        cutOffDate?: Date,
        limit?: number,
        type?: WorkspaceType,
    ): Promise<WorkspaceAndOwner[]>;
    findWorkspacesForContentDeletion(
        minSoftDeletedTimeInDays: number,
        limit: number,
    ): Promise<WorkspaceOwnerAndSoftDeleted[]>;
    findWorkspacesForPurging(
        minContentDeletionTimeInDays: number,
        limit: number,
        now: Date,
    ): Promise<WorkspaceAndOwner[]>;
    findAllWorkspaces(
        offset: number,
        limit: number,
        orderBy: keyof Workspace,
        orderDir: "ASC" | "DESC",
        opts: {
            ownerId?: string;
            type?: WorkspaceType;
        },
    ): Promise<{ total: number; rows: Workspace[] }>;
    findAllWorkspaceAndInstances(
        offset: number,
        limit: number,
        orderBy: keyof WorkspaceAndInstance,
        orderDir: "ASC" | "DESC",
        query?: AdminGetWorkspacesQuery,
    ): Promise<{ total: number; rows: WorkspaceAndInstance[] }>;
    findWorkspaceAndInstance(id: string): Promise<WorkspaceAndInstance | undefined>;
    findInstancesByPhase(phases: string[]): Promise<WorkspaceInstance[]>;

    getWorkspaceCount(type?: String): Promise<Number>;
    getInstanceCount(type?: string): Promise<number>;

    findRegularRunningInstances(userId?: string): Promise<WorkspaceInstance[]>;
    findRunningInstancesWithWorkspaces(
        workspaceClusterName?: string,
        userId?: string,
        includeStopping?: boolean,
    ): Promise<RunningWorkspaceInfo[]>;

    findSnapshotById(snapshotId: string): Promise<Snapshot | undefined>;
    findSnapshotsWithState(
        state: SnapshotState,
        offset: number,
        limit: number,
    ): Promise<{ snapshots: Snapshot[]; total: number }>;
    findSnapshotsByWorkspaceId(workspaceId: string): Promise<Snapshot[]>;
    storeSnapshot(snapshot: Snapshot): Promise<Snapshot>;
    deleteSnapshot(snapshotId: string): Promise<void>;
    updateSnapshot(snapshot: DeepPartial<Snapshot> & Pick<Snapshot, "id">): Promise<void>;

    storePrebuiltWorkspace(pws: PrebuiltWorkspace): Promise<PrebuiltWorkspace>;
    findPrebuiltWorkspaceByCommit(projectId: string, commit: string): Promise<PrebuiltWorkspace | undefined>;
    findActivePrebuiltWorkspacesByBranch(
        projectId: string,
        branch: string,
    ): Promise<PrebuildWithWorkspaceAndInstances[]>;
    findPrebuildsWithWorkspace(projectId: string): Promise<PrebuildWithWorkspace[]>;
    findPrebuildWithStatus(prebuildId: string): Promise<PrebuildWithStatus | undefined>;
    findPrebuildByWorkspaceID(wsid: string): Promise<PrebuiltWorkspace | undefined>;
    findPrebuildByID(pwsid: string): Promise<PrebuiltWorkspace | undefined>;
    countUnabortedPrebuildsSince(projectId: string, date: Date): Promise<number>;
    attachUpdatableToPrebuild(pwsid: string, update: PrebuiltWorkspaceUpdatable): Promise<void>;
    findUpdatablesForPrebuild(pwsid: string): Promise<PrebuiltWorkspaceUpdatable[]>;
    markUpdatableResolved(updatableId: string): Promise<void>;
    getUnresolvedUpdatables(limit?: number): Promise<PrebuiltUpdatableAndWorkspace[]>;

    hardDeleteWorkspace(workspaceID: string): Promise<void>;

    findPrebuiltWorkspacesByOrganization(
        organizationId: string,
        pagination: {
            offset: number;
            limit: number;
        },
        filter: {
            configuration?: {
                id: string;
                branch?: string;
            };
            state?: "succeeded" | "failed" | "unfinished";
            searchTerm?: string;
        },
        sort: {
            field: string;
            order: "ASC" | "DESC";
        },
    ): Promise<PrebuiltWorkspaceWithWorkspace[]>;
    findPrebuiltWorkspaceById(prebuildId: string): Promise<PrebuiltWorkspace | undefined>;

    storePrebuildInfo(prebuildInfo: PrebuildInfo): Promise<void>;
    findPrebuildInfos(prebuildIds: string[]): Promise<PrebuildInfo[]>;
}
