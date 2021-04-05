/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User, Workspace, NamedWorkspaceFeatureFlag } from "./protocol";
import { Without } from "./util/without";
import { WorkspaceInstance, WorkspaceInstancePhase } from "./workspace-instance";
import { RoleOrPermission } from "./permission";
import { AccountStatement } from "./accounting-protocol";

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

    adminSetLicense(key: string): Promise<void>;

    adminGetAccountStatement(userId: string): Promise<AccountStatement>;
    adminSetProfessionalOpenSource(userId: string, shouldGetProfOSS: boolean): Promise<void>;
    adminIsStudent(userId: string): Promise<boolean>;
    adminAddStudentEmailDomain(userId: string, domain: string): Promise<void>;
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

export interface WorkspaceAndInstance extends Without<Workspace, "id"|"creationTime">, Without<WorkspaceInstance, "id"|"creationTime"> {
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
            ... wai
        };
    }

    export function toInstance(wai: WorkspaceAndInstance): WorkspaceInstance | undefined {
        if (!wai.instanceId) {
            return undefined;
        }
        return {
            id: wai.instanceId,
            creationTime: wai.instanceCreationTime,
            ... wai
        };
    }
}

export interface AdminGetWorkspacesRequest extends AdminGetListRequest<WorkspaceAndInstance> {
    ownerId?: string
}