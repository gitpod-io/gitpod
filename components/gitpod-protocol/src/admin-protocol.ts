/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User, Workspace, NamedWorkspaceFeatureFlag } from "./protocol";
import { WorkspaceInstance, WorkspaceInstancePhase } from "./workspace-instance";
import { RoleOrPermission } from "./permission";
import { AccountStatement } from "./accounting-protocol";
import { InstallationAdminSettings } from "./installation-admin-protocol";

export interface AdminServer {
    adminGetUsers(req: AdminGetListRequest<User>): Promise<AdminGetListResult<User>>;
    adminGetUser(id: string): Promise<User>;
    adminBlockUser(req: AdminBlockUserRequest): Promise<User>;
    adminDeleteUser(id: string): Promise<void>;
    adminModifyRoleOrPermission(req: AdminModifyRoleOrPermissionRequest): Promise<User>;
    adminModifyPermanentWorkspaceFeatureFlag(req: AdminModifyPermanentWorkspaceFeatureFlagRequest): Promise<User>;

    adminGetWorkspaces(req: AdminGetWorkspacesRequest): Promise<AdminGetListResult<WorkspaceAndInstance>>;
    adminGetWorkspace(id: string): Promise<WorkspaceAndInstance>;
    adminForceStopWorkspace(id: string): Promise<void>;
    adminRestoreSoftDeletedWorkspace(id: string): Promise<void>;

    adminSetLicense(key: string): Promise<void>;

    adminGetAccountStatement(userId: string): Promise<AccountStatement>;
    adminSetProfessionalOpenSource(userId: string, shouldGetProfOSS: boolean): Promise<void>;
    adminIsStudent(userId: string): Promise<boolean>;
    adminAddStudentEmailDomain(userId: string, domain: string): Promise<void>;
    adminGrantExtraHours(userId: string, extraHours: number): Promise<void>;

    adminGetSettings(): Promise<InstallationAdminSettings>
    adminUpdateSettings(settings: InstallationAdminSettings): Promise<void>
}

export interface AdminGetListRequest<T> {
    offset: number
    limit: number
    orderBy: keyof T
    orderDir: "asc" | "desc"
    searchTerm?: string;
}

export interface AdminGetListResult<T> {
    total: number
    rows: T[]
}

export interface AdminBlockUserRequest {
    id: string
    blocked: boolean
}

export interface AdminModifyRoleOrPermissionRequest {
    id: string;
    rpp: {
        r: RoleOrPermission
        add: boolean
    }[]
}

export interface AdminModifyPermanentWorkspaceFeatureFlagRequest {
    id: string;
    changes: {
        featureFlag: NamedWorkspaceFeatureFlag
        add: boolean
    }[]
}

export interface WorkspaceAndInstance extends Omit<Workspace, "id" | "creationTime">, Omit<WorkspaceInstance, "id" | "creationTime"> {
    workspaceId: string;
    workspaceCreationTime: string;
    instanceId: string;
    instanceCreationTime: string;
    phase: WorkspaceInstancePhase;
}

export namespace WorkspaceAndInstance {
    export function toWorkspace(wai: WorkspaceAndInstance): Workspace {
        return {
            id: wai.workspaceId,
            creationTime: wai.workspaceCreationTime,
            ...wai
        };
    }

    export function toInstance(wai: WorkspaceAndInstance): WorkspaceInstance | undefined {
        if (!wai.instanceId) {
            return undefined;
        }
        return {
            id: wai.instanceId,
            creationTime: wai.instanceCreationTime,
            ...wai
        };
    }
}

export type AdminGetWorkspacesRequest = AdminGetListRequest<WorkspaceAndInstance> & AdminGetWorkspacesQuery;
/** The fields are meant to be used either OR (not combined) */
export type AdminGetWorkspacesQuery = {
    /** we use this field in case we have a UUIDv4 and don't know whether it's an (old) workspace or instance id */
    instanceIdOrWorkspaceId?: string;
    instanceId?: string;
    workspaceId?: string;
    ownerId?: string;
};