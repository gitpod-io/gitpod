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
    adminGetUsers(params: AdminServer.AdminGetUsersParams): Promise<AdminServer.AdminGetListResult<User>>;
    adminGetUser(params: AdminServer.AdminGetUserParams): Promise<User>;
    adminBlockUser(params: AdminServer.AdminBlockUserParams): Promise<User>;
    adminModifyRoleOrPermission(params: AdminServer.AdminModifyRoleOrPermissionParams): Promise<User>;
    adminModifyPermanentWorkspaceFeatureFlag(params: AdminServer.AdminModifyPermanentWorkspaceFeatureFlagParams): Promise<User>;

    adminGetWorkspaces(params: AdminServer.AdminGetWorkspacesParams): Promise<AdminServer.AdminGetListResult<AdminServer.WorkspaceAndInstance>>;
    adminGetWorkspace(params: AdminServer.AdminGetWorkspaceParams): Promise<AdminServer.WorkspaceAndInstance>;
    adminForceStopWorkspace(params: AdminServer.adminForceStopWorkspaceParams): Promise<void>;

    adminSetLicense(params: AdminServer.AdminSetLicenseParams): Promise<void>;
}

export namespace AdminServer {
    export type AdminGetUsersParams = AdminGetListParams<User>

    export interface AdminGetUserParams {
        readonly id: string;
    }

    export interface AdminGetListParams<T> {
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

    export interface AdminBlockUserParams {
        id: string
        blocked: boolean
    }

    export interface AdminModifyRoleOrPermissionParams {
        id: string;
        rpp: {
            r: RoleOrPermission
            add: boolean
        }[]
    }

    export interface AdminModifyPermanentWorkspaceFeatureFlagParams {
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

    export interface AdminGetWorkspacesParams extends AdminGetListParams<WorkspaceAndInstance> {
        ownerId?: string
    }

    export interface AdminGetWorkspaceParams {
        workspaceId: string;
    }

    export interface adminForceStopWorkspaceParams {
        workspaceId: string;
    }

    export interface AdminSetLicenseParams {
        key: string;
    }
}
