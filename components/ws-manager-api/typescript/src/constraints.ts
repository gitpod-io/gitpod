/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PermissionName, RolesOrPermissions, User, Workspace, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { AdmissionConstraint, WorkspaceClusterWoTLS } from "@gitpod/gitpod-protocol/lib/workspace-cluster";

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

export const workspaceClusterSetsAuthorizedAndSupportsWorkspaceClass = workspaceClusterSetsAuthorized.map((set) => ({
    ...set,
    constraint: intersect(set.constraint, constraintClusterSupportsWorkspaceClass),
}));

export type Constraint = (all: WorkspaceClusterWoTLS[], args: ConstraintArgs) => WorkspaceClusterWoTLS[];

export type ConstraintArgs = {
    user: User;
    workspace?: Workspace;
    instance?: WorkspaceInstance;
    region?: string;
};

export function invert(c: Constraint): Constraint {
    return (all: WorkspaceClusterWoTLS[], args: ConstraintArgs) => {
        const s = c(all, args);
        return all.filter((c) => !s.find((sc) => c.name === sc.name));
    };
}

export function intersect(...cs: Constraint[]): Constraint {
    return (all: WorkspaceClusterWoTLS[], args: ConstraintArgs) => {
        if (cs.length === 0) {
            // no constraints means all clusters match
            return all;
        }

        const sets = cs.map((c) => c(all, args));

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
    return (all: WorkspaceClusterWoTLS[], args: ConstraintArgs) => {
        return all.filter((cluster) => !permissions.some((p) => hasPermissionConstraint(cluster, p)));
    };
}

/**
 * The returned Constraint returns all clusters that require _any_ of the given permissions
 * @param permissions
 * @returns
 */
export function constraintHasPermissions(...permissions: PermissionName[]): Constraint {
    return (all: WorkspaceClusterWoTLS[], args: ConstraintArgs) => {
        return all.filter((cluster) => permissions.some((p) => hasPermissionConstraint(cluster, p)));
    };
}

export function constraintRegional(all: WorkspaceClusterWoTLS[], args: ConstraintArgs): WorkspaceClusterWoTLS[] {
    if (!args.region || args.region.length === 0) {
        return [];
    }
    return all.filter((cluster) => cluster.region === args.region);
}

/**
 * This Constraint filters out clusters that the user is not allowed to access
 * @returns
 */
export function constraintUserIsAuthorized(
    all: WorkspaceClusterWoTLS[],
    args: ConstraintArgs,
): WorkspaceClusterWoTLS[] {
    return all.filter((cluster) => userMayAccessCluster(cluster, args.user));
}

function userMayAccessCluster(cluster: WorkspaceClusterWoTLS, user: User): boolean {
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

export function constraintClusterSupportsWorkspaceClass(
    all: WorkspaceClusterWoTLS[],
    args: ConstraintArgs,
): WorkspaceClusterWoTLS[] {
    const workspaceClass = args.instance?.workspaceClass;
    if (!workspaceClass) {
        return all;
    }
    return all.filter((cluster) => (cluster.availableWorkspaceClasses || []).map((c) => c.id).includes(workspaceClass));
}
