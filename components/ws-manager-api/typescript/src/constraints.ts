/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PermissionName, RolesOrPermissions, User, Workspace, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { AdmissionConstraint, WorkspaceClusterWoTLS } from "@gitpod/gitpod-protocol/lib/workspace-cluster";

/**
 * ExtendedUser adds additional attributes to a user which are helpful
 * during cluster selection.
 */
export interface ExtendedUser extends User {}

export interface WorkspaceClusterConstraintSet {
    name: string;
    constraint: Constraint;
}

/**
 * workspaceClusterSets defines an order of preference in which we'll select
 * workspace cluster when starting a workspace.
 */
const workspaceClusterSets: WorkspaceClusterConstraintSet[] = [
    {
        name: "new workspace cluster",
        constraint: constraintHasPermissions("new-workspace-cluster"),
    },
    {
        name: "regional",
        constraint: intersect(constraintRegional),
    },
    {
        name: "non-regional",
        constraint: intersect(invert(constraintRegional)),
    },
];

/**
 * workspaceClusterSetsAuthorized applies the constraint "is user authorized" to all workspaceClusterSets
 */
export const workspaceClusterSetsAuthorized = workspaceClusterSets.map((set) => ({
    ...set,
    constraint: intersect(set.constraint, constraintUserIsAuthorized),
}));

export type Constraint = (
    all: WorkspaceClusterWoTLS[],
    user: ExtendedUser,
    workspace: Workspace,
    instance: WorkspaceInstance,
) => WorkspaceClusterWoTLS[];

export function invert(c: Constraint): Constraint {
    return (all: WorkspaceClusterWoTLS[], user: ExtendedUser, workspace: Workspace, instance: WorkspaceInstance) => {
        const s = c(all, user, workspace, instance);
        return all.filter((c) => !s.find((sc) => c.name === sc.name));
    };
}

export function intersect(...cs: Constraint[]): Constraint {
    return (all: WorkspaceClusterWoTLS[], user: ExtendedUser, workspace: Workspace, instance: WorkspaceInstance) => {
        if (cs.length === 0) {
            // no constraints means all clusters match
            return all;
        }

        const sets = cs.map((c) => c(all, user, workspace, instance));

        return sets[0].filter((c) => sets.slice(1).every((s) => s.includes(c)));
    };
}

function hasPermissionConstraint(cluster: WorkspaceClusterWoTLS, permission: PermissionName): boolean {
    return !!cluster.admissionConstraints?.find((constraint) =>
        AdmissionConstraint.hasPermission(constraint, permission),
    );
}

/**
 * The returned Constraint _filters out_ all clusters that require _any_ of the given permissions
 * @param permissions
 * @returns
 */
export function constraintInverseHasPermissions(...permissions: PermissionName[]): Constraint {
    return (all: WorkspaceClusterWoTLS[], user: ExtendedUser, workspace: Workspace, instance: WorkspaceInstance) => {
        return all.filter((cluster) => !permissions.some((p) => hasPermissionConstraint(cluster, p)));
    };
}

/**
 * The returned Constraint returns all clusters that require _any_ of the given permissions
 * @param permissions
 * @returns
 */
export function constraintHasPermissions(...permissions: PermissionName[]): Constraint {
    return (all: WorkspaceClusterWoTLS[], user: ExtendedUser, workspace: Workspace, instance: WorkspaceInstance) => {
        return all.filter((cluster) => permissions.some((p) => hasPermissionConstraint(cluster, p)));
    };
}

export function constraintRegional(
    all: WorkspaceClusterWoTLS[],
    user: ExtendedUser,
    workspace: Workspace,
    instance: WorkspaceInstance,
): WorkspaceClusterWoTLS[] {
    // TODO(cw): implement me
    return [];
}

/**
 * This Constraint filters out clusters that the user is not allowed to access
 * @returns
 */
export function constraintUserIsAuthorized(
    all: WorkspaceClusterWoTLS[],
    user: ExtendedUser,
    workspace: Workspace,
    instance: WorkspaceInstance,
): WorkspaceClusterWoTLS[] {
    return all.filter((cluster) => userMayAccessCluster(cluster, user));
}

function userMayAccessCluster(cluster: WorkspaceClusterWoTLS, user: ExtendedUser): boolean {
    const userPermissions = RolesOrPermissions.toPermissionSet(user.rolesOrPermissions);
    return (cluster.admissionConstraints || []).every((c) => {
        switch (c.type) {
            case "has-permission":
                return userPermissions.has(c.permission);
            default:
                return true; // no reason to exclude user
        }
    });
}
