/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// see below for explanation
export const Permissions = {
    developer: undefined,
    "registry-access": undefined,
    "admin-permissions": undefined,
    "admin-users": undefined,
    "admin-workspace-content": undefined,
    "admin-workspaces": undefined,
    "admin-projects": undefined,
    "new-workspace-cluster": undefined,
};
export type PermissionName = keyof typeof Permissions;
export const Roles = { devops: undefined, viewer: undefined, admin: undefined };
export type RoleName = keyof typeof Roles;
export type RoleOrPermission = RoleName | PermissionName;

export namespace RoleName {
    export const is = (o: any): o is RoleName => {
        return typeof o === "string" && Role.all().some((r) => r.name === o);
    };
}

export interface Role {
    name: RoleName;
    permissions: PermissionName[];
}

export namespace RolesOrPermissions {
    export function toPermissionSet(rolesOrPermissions: RoleOrPermission[] | undefined): Set<PermissionName> {
        rolesOrPermissions = rolesOrPermissions || [];

        const permissions = new Set<PermissionName>();
        for (const rop of rolesOrPermissions) {
            if (Permission.is(rop)) {
                permissions.add(rop);
            } else if (RoleName.is(rop)) {
                Role.getByName(rop).permissions.forEach((p) => permissions.add(p));
            }
        }
        return permissions;
    }
}

export namespace Permission {
    /** The permission to develop on this running Gitpod installation */
    export const DEVELOPER: PermissionName = "developer";

    /** The permission for registry access (start workspaces referencing gitpod-internal Docker images) */
    export const REGISTRY_ACCESS: PermissionName = "registry-access";

    /** The permission for administration and deletion of user data */
    export const ADMIN_PERMISSIONS: PermissionName = "admin-permissions";

    /** The permission for accessing user data */
    export const ADMIN_USERS: PermissionName = "admin-users";

    /** The permission for accessing workspace content */
    export const ADMIN_WORKSPACE_CONTENT: PermissionName = "admin-workspace-content";

    /** The permission for accessing workspace data */
    export const ADMIN_WORKSPACES: PermissionName = "admin-workspaces";

    /** The permission for accessing all projects data */
    export const ADMIN_PROJECTS: PermissionName = "admin-projects";

    export const is = (o: any): o is PermissionName => {
        return typeof o === "string" && Permission.all().some((p) => p === o);
    };

    export const all = (): PermissionName[] => {
        return Object.keys(Permissions) as PermissionName[];
    };
}

export namespace Role {
    /** A role for people that are allowed to view Gitpod internals */
    export const VIEWER: Role = {
        name: "viewer",
        permissions: [Permission.REGISTRY_ACCESS],
    };

    export const ADMIN: Role = {
        name: "admin",
        permissions: [Permission.ADMIN_USERS, Permission.ADMIN_WORKSPACES, Permission.ADMIN_PROJECTS],
    };

    export const getByName = (name: RoleName): Role => {
        const result = Role.all().find((r) => r.name === name);
        if (!result) {
            throw Error("Unknown RoleName: " + name);
        }
        return result;
    };

    export const all = (): Role[] => {
        return Object.keys(Role)
            .map((k) => (Role as any)[k])
            .filter((k) => typeof k === "object");
    };
}
