/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User, Workspace, NamedWorkspaceFeatureFlag } from "./protocol";
import { Without } from "./util/without";
import { WorkspaceInstance, WorkspaceInstancePhase } from "./workspace-instance";
import { RoleOrPermission } from "./permission";

export interface AdminServer {
    adminGetUsers(req: AdminGetListRequest<User>): Promise<AdminGetListResult<User>>;
    adminGetUser(id: string): Promise<User>;
    adminBlockUser(req: AdminBlockUserRequest): Promise<User>;
    adminModifyRoleOrPermission(req: AdminModifyRoleOrPermissionRequest): Promise<User>;
    adminModifyPermanentWorkspaceFeatureFlag(req: AdminModifyPermanentWorkspaceFeatureFlagRequest): Promise<User>;

    adminGetWorkspaces(req: AdminGetWorkspacesRequest): Promise<AdminGetListResult<WorkspaceAndInstance>>;
    adminGetWorkspace(id: string): Promise<WorkspaceAndInstance>;
    adminForceStopWorkspace(id: string): Promise<void>;

    adminSetLicense(key: string): Promise<void>;
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

export interface AdminGetWorkspacesRequest extends AdminGetListRequest<WorkspaceAndInstance> {
    ownerId?: string
}