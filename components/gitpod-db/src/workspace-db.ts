/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { DeepPartial } from 'typeorm';

import { Workspace, WorkspaceInfo, WorkspaceInstance, WorkspaceInstanceUser, WhitelistedRepository, Snapshot, LayoutData, PrebuiltWorkspace, PrebuiltWorkspaceUpdatable, RunningWorkspaceInfo, WorkspaceAndInstance, WorkspaceType, PrebuildInfo, AdminGetWorkspacesQuery } from '@gitpod/gitpod-protocol';

export type MaybeWorkspace = Workspace | undefined;
export type MaybeWorkspaceInstance = WorkspaceInstance | undefined;

export interface FindWorkspacesOptions {
    userId: string
    projectId?: string | string[]
    includeWithoutProject?: boolean;
    limit?: number
    searchString?: string
    includeHeadless?: boolean
    pinnedOnly?: boolean
}

export interface PrebuiltUpdatableAndWorkspace extends PrebuiltWorkspaceUpdatable {
    prebuild: PrebuiltWorkspace
    workspace: Workspace
    instance: WorkspaceInstance
}

export type WorkspaceAuthData = Pick<Workspace, "id" | "ownerId" | "shareable">;
export type WorkspaceInstancePortsAuthData = Pick<WorkspaceInstance, "id" | "region">;
export interface WorkspacePortsAuthData {
    instance: WorkspaceInstancePortsAuthData;
    workspace: WorkspaceAuthData;
}

export type WorkspaceInstanceSession = Pick<WorkspaceInstance, "id" | "startedTime"| "stoppingTime" | "stoppedTime">;
export type WorkspaceSessionData = Pick<Workspace, "id" | "contextURL" | "context" | "type">;
export interface WorkspaceInstanceSessionWithWorkspace {
    instance: WorkspaceInstanceSession;
    workspace: WorkspaceSessionData;
}

export interface PrebuildWithWorkspace {
    prebuild: PrebuiltWorkspace;
    workspace: Workspace;
}

export type WorkspaceAndOwner = Pick<Workspace, "id" | "ownerId">;
export type WorkspaceOwnerAndSoftDeleted = Pick<Workspace, "id" | "ownerId" | "softDeleted">;

export const WorkspaceDB = Symbol('WorkspaceDB');
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
    getLastOwnerHeartbeatFor(instance: WorkspaceInstance): Promise<{ lastSeen:Date, wasClosed?: boolean} | undefined>;
    getWorkspaceUsers(workspaceId: string, minLastSeen: number): Promise<WorkspaceInstanceUser[]>;
    updateInstancePartial(instanceId: string, partial: DeepPartial<WorkspaceInstance>): Promise<WorkspaceInstance>;

    findInstanceById(workspaceInstanceId: string): Promise<MaybeWorkspaceInstance>;
    findInstances(workspaceId: string): Promise<WorkspaceInstance[]>;
    findWorkspacesByUser(userId: string): Promise<Workspace[]>;
    findCurrentInstance(workspaceId: string): Promise<MaybeWorkspaceInstance>;
    findRunningInstance(workspaceId: string): Promise<MaybeWorkspaceInstance>;
    findSessionsInPeriod(userId: string, periodStart: string, periodEnd: string): Promise<WorkspaceInstanceSessionWithWorkspace[]>;
    findWorkspacesForGarbageCollection(minAgeInDays: number, limit: number): Promise<WorkspaceAndOwner[]>;
    findWorkspacesForContentDeletion(minSoftDeletedTimeInDays: number, limit: number): Promise<WorkspaceOwnerAndSoftDeleted[]>;
    findPrebuiltWorkspacesForGC(daysUnused: number, limit: number): Promise<WorkspaceAndOwner[]>;
    findAllWorkspaces(offset: number, limit: number, orderBy: keyof Workspace, orderDir: "ASC" | "DESC", ownerId?: string, searchTerm?: string, minCreationTime?: Date, maxCreationDateTime?: Date, type?: WorkspaceType): Promise<{ total: number, rows: Workspace[] }>;
    findAllWorkspaceAndInstances(offset: number, limit: number, orderBy: keyof WorkspaceAndInstance, orderDir: "ASC" | "DESC", query?: AdminGetWorkspacesQuery, searchTerm?: string): Promise<{ total: number, rows: WorkspaceAndInstance[] }>;
    findWorkspaceAndInstance(id: string): Promise<WorkspaceAndInstance | undefined>;

    findAllWorkspaceInstances(offset: number, limit: number, orderBy: keyof WorkspaceInstance, orderDir: "ASC" | "DESC", ownerId?: string, minCreationTime?: Date, maxCreationTime?: Date, onlyRunning?: boolean, type?: WorkspaceType): Promise<{ total: number, rows: WorkspaceInstance[] }>;

    findRegularRunningInstances(userId?: string): Promise<WorkspaceInstance[]>;
    findRunningInstancesWithWorkspaces(installation?: string, userId?: string, includeStopping?: boolean): Promise<RunningWorkspaceInfo[]>;

    isWhitelisted(repositoryUrl : string): Promise<boolean>;
    getFeaturedRepositories(): Promise<Partial<WhitelistedRepository>[]>;

    findSnapshotById(snapshotId: string): Promise<Snapshot | undefined>;
    findSnapshotsByWorkspaceId(workspaceId: string): Promise<Snapshot[]>;
    storeSnapshot(snapshot: Snapshot): Promise<Snapshot>;

    storePrebuiltWorkspace(pws: PrebuiltWorkspace): Promise<PrebuiltWorkspace>;
    findPrebuiltWorkspaceByCommit(cloneURL: string, commit: string): Promise<PrebuiltWorkspace | undefined>;
    findPrebuildsWithWorkpace(cloneURL: string): Promise<PrebuildWithWorkspace[]>;
    findPrebuildByWorkspaceID(wsid: string): Promise<PrebuiltWorkspace | undefined>;
    findPrebuildByID(pwsid: string): Promise<PrebuiltWorkspace | undefined>;
    countRunningPrebuilds(cloneURL: string): Promise<number>;
    findQueuedPrebuilds(cloneURL?: string): Promise<PrebuildWithWorkspace[]>;
    attachUpdatableToPrebuild(pwsid: string, update: PrebuiltWorkspaceUpdatable): Promise<void>;
    findUpdatablesForPrebuild(pwsid: string): Promise<PrebuiltWorkspaceUpdatable[]>;
    markUpdatableResolved(updatableId: string): Promise<void>;
    getUnresolvedUpdatables(): Promise<PrebuiltUpdatableAndWorkspace[]>;

    findLayoutDataByWorkspaceId(workspaceId: string): Promise<LayoutData | undefined>;
    storeLayoutData(layoutData: LayoutData): Promise<LayoutData>;

    hardDeleteWorkspace(workspaceID: string): Promise<void>;

    findPrebuiltWorkspacesByProject(projectId: string, branch?: string, limit?: number): Promise<PrebuiltWorkspace[]>;
    findPrebuiltWorkspaceById(prebuildId: string): Promise<PrebuiltWorkspace | undefined>;

    storePrebuildInfo(prebuildInfo: PrebuildInfo): Promise<void>;
    findPrebuildInfos(prebuildIds: string[]): Promise<PrebuildInfo[]>;
}
