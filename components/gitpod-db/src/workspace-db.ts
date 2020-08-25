/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { DeepPartial } from 'typeorm';
import { injectable } from 'inversify';

import { Workspace, WorkspaceInfo, WorkspaceInstance, WorkspaceInstanceUser, WhitelistedRepository, Snapshot, LayoutData, PrebuiltWorkspace, PrebuiltWorkspaceUpdatable, RunningWorkspaceInfo, WorkspaceAndInstance, WorkspaceType } from '@gitpod/gitpod-protocol';

export type MaybeWorkspace = Workspace | undefined;
export type MaybeWorkspaceInstance = WorkspaceInstance | undefined;

export interface FindWorkspacesOptions {
    userId: string
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

export type WorkspaceInstanceSession = Pick<WorkspaceInstance, "id" | "startedTime" | "stoppedTime">;
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
    findAllWorkspaceAndInstances(offset: number, limit: number, orderBy: keyof WorkspaceAndInstance, orderDir: "ASC" | "DESC", ownerId?: string, searchTerm?: string): Promise<{ total: number, rows: WorkspaceAndInstance[] }>;
    findWorkspaceAndInstance(id: string): Promise<WorkspaceAndInstance | undefined>;

    findAllWorkspaceInstances(offset: number, limit: number, orderBy: keyof WorkspaceInstance, orderDir: "ASC" | "DESC", ownerId?: string, minCreationTime?: Date, maxCreationTime?: Date, onlyRunning?: boolean, type?: WorkspaceType): Promise<{ total: number, rows: WorkspaceInstance[] }>;

    findRegularRunningInstances(userId?: string): Promise<WorkspaceInstance[]>;
    findRunningInstancesWithWorkspaces(installation?: string, userId?: string): Promise<RunningWorkspaceInfo[]>;

    isWhitelisted(repositoryUrl : string): Promise<boolean>;
    getFeaturedRepositories(): Promise<Partial<WhitelistedRepository>[]>;

    findSnapshotById(snapshotId: string): Promise<Snapshot | undefined>;
    findSnapshotsByWorkspaceId(workspaceId: string): Promise<Snapshot[]>;
    storeSnapshot(snapshot: Snapshot): Promise<Snapshot>;

    getTotalPrebuildUseSeconds(forDays: number): Promise<number | undefined>;
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
}

@injectable()
export abstract class AbstractWorkspaceDB implements WorkspaceDB {
    abstract connect(maxTries: number, timeout: number): Promise<void>;

    abstract store(workspace: Workspace): Promise<Workspace>;
    abstract updatePartial(workspaceId: string, partial: DeepPartial<Workspace>): Promise<void>;
    abstract findById(id: string): Promise<MaybeWorkspace>;
    abstract findByInstanceId(id: string): Promise<MaybeWorkspace>;
    abstract find(options: FindWorkspacesOptions): Promise<WorkspaceInfo[]>;
    abstract findWorkspacePortsAuthDataById(workspaceId: string): Promise<WorkspacePortsAuthData | undefined>;

    abstract findInstanceById(workspaceInstanceId: string): Promise<MaybeWorkspaceInstance>;
    abstract findInstances(workspaceId: string): Promise<WorkspaceInstance[]>;
    abstract findWorkspacesByUser(userId: string): Promise<Workspace[]>;
    abstract internalStoreInstance(instance: WorkspaceInstance): Promise<WorkspaceInstance>;
    abstract findRegularRunningInstances(userId?: string): Promise<WorkspaceInstance[]>;
    abstract findRunningInstancesWithWorkspaces(installation?: string, userId?: string): Promise<RunningWorkspaceInfo[]>;
    abstract findSessionsInPeriod(userId: string, periodStart: string, periodEnd: string): Promise<WorkspaceInstanceSessionWithWorkspace[]>;
    abstract findWorkspacesForGarbageCollection(minAgeInDays: number, limit: number): Promise<WorkspaceAndOwner[]>;
    abstract findWorkspacesForContentDeletion(minSoftDeletedTimeInDays: number, limit: number): Promise<WorkspaceOwnerAndSoftDeleted[]>;
    abstract findPrebuiltWorkspacesForGC(daysUnused: number, limit: number): Promise<WorkspaceAndOwner[]>
    abstract findAllWorkspaceAndInstances(offset: number, limit: number, orderBy: keyof WorkspaceAndInstance, orderDir: "ASC" | "DESC", ownerId?: string, searchTerm?: string): Promise<{ total: number, rows: WorkspaceAndInstance[] }>;
    abstract findWorkspaceAndInstance(id: string): Promise<WorkspaceAndInstance | undefined>;
    abstract findAllWorkspaces(offset: number, limit: number, orderBy: keyof Workspace, orderDir: "ASC" | "DESC", ownerId?: string, searchTerm?: string, minCreationTime?: Date, maxCreationDateTime?: Date, type?: WorkspaceType): Promise<{ total: number, rows: Workspace[] }>;
    abstract findAllWorkspaceInstances(offset: number, limit: number, orderBy: keyof WorkspaceInstance, orderDir: "ASC" | "DESC", ownerId?: string, minCreationTime?: Date, maxCreationTime?: Date, onlyRunning?: boolean, type?: WorkspaceType): Promise<{ total: number, rows: WorkspaceInstance[] }>;

    public async transaction<T>(code: (db: WorkspaceDB) => Promise<T>): Promise<T> {
        return code(this);
    }

    async storeInstance(instance: WorkspaceInstance): Promise<WorkspaceInstance> {
        const inst = await this.internalStoreInstance(instance);
        return inst;
    }

    abstract updateLastHeartbeat(instanceId: string, userId: string, newHeartbeat: Date, wasClosed?: boolean): Promise<void>;
    abstract getLastOwnerHeartbeatFor(instance: WorkspaceInstance): Promise<{ lastSeen: Date, wasClosed?: boolean} | undefined>;
    abstract getWorkspaceUsers(workspaceId: string, minLastSeen: number): Promise<WorkspaceInstanceUser[]>;
    abstract updateInstancePartial(instanceId: string, partial: DeepPartial<WorkspaceInstance>): Promise<WorkspaceInstance>;

    abstract findCurrentInstance(workspaceId: string): Promise<MaybeWorkspaceInstance>;

    public async findRunningInstance(workspaceId: string): Promise<MaybeWorkspaceInstance> {
        const instance = await this.findCurrentInstance(workspaceId)
        if (instance && instance.status.phase !== 'stopped') {
            return instance;
        }
        return undefined;
    }

    abstract isWhitelisted(repositoryUrl : string): Promise<boolean>;
    abstract getFeaturedRepositories(): Promise<Partial<WhitelistedRepository>[]>;

    abstract findSnapshotById(snapshotId: string): Promise<Snapshot | undefined>;
    abstract findSnapshotsByWorkspaceId(workspaceId: string): Promise<Snapshot[]>;
    abstract storeSnapshot(snapshot: Snapshot): Promise<Snapshot>;

    abstract getTotalPrebuildUseSeconds(forDays: number): Promise<number | undefined>;
    abstract storePrebuiltWorkspace(pws: PrebuiltWorkspace): Promise<PrebuiltWorkspace>;
    abstract findPrebuiltWorkspaceByCommit(cloneURL: string, commit: string): Promise<PrebuiltWorkspace | undefined>;
    abstract findPrebuildsWithWorkpace(cloneURL: string): Promise<PrebuildWithWorkspace[]>;
    abstract findPrebuildByWorkspaceID(wsid: string): Promise<PrebuiltWorkspace | undefined>;
    abstract findPrebuildByID(pwsid: string): Promise<PrebuiltWorkspace | undefined>;
    abstract countRunningPrebuilds(cloneURL: string): Promise<number>;
    abstract findQueuedPrebuilds(cloneURL?: string): Promise<PrebuildWithWorkspace[]>;
    abstract attachUpdatableToPrebuild(pwsid: string, update: PrebuiltWorkspaceUpdatable): Promise<void>;
    abstract findUpdatablesForPrebuild(pwsid: string): Promise<PrebuiltWorkspaceUpdatable[]>;
    abstract markUpdatableResolved(updatableId: string): Promise<void>;
    abstract getUnresolvedUpdatables(): Promise<PrebuiltUpdatableAndWorkspace[]>;

    abstract findLayoutDataByWorkspaceId(workspaceId: string): Promise<LayoutData | undefined>;
    abstract storeLayoutData(layoutData: LayoutData): Promise<LayoutData>;

    abstract hardDeleteWorkspace(workspaceID: string): Promise<void>;
}