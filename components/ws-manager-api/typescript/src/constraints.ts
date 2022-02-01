/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User, Workspace, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { WorkspaceClusterWoTLS } from "@gitpod/gitpod-protocol/lib/workspace-cluster";

/**
 * ExtendedUser adds additional attributes to a user which are helpful
 * during cluster selection.
 */
export interface ExtendedUser extends User  {
    level?: string;
}

export interface WorkspaceClusterConstraintSet {
    name: string;
    constraint: Constraint;
}

export const workspaceClusterSets: WorkspaceClusterConstraintSet[] = [
    {
        name: "new workspace cluster",
        constraint: constraintNewWorkspaceCluster
    },
    {
        name: "regional more resources",
        constraint:
            intersect(
                constraintRegional,
                constraintMoreResources,
                constraintInverseNewWorkspaceCluster
            )
    },
    {
        name: "regional reguilar",
        constraint:
            intersect(
                constraintRegional,
                invert(constraintMoreResources),
                constraintInverseNewWorkspaceCluster
            )
    },
    {
        name: "non-regional more resources",
        constraint:
            intersect(
                invert(constraintRegional),
                constraintMoreResources,
                constraintInverseNewWorkspaceCluster
            )
    },
    {
        name: "non-regional non-paying",
        constraint:
            intersect(
                invert(
                    intersect(
                        constraintRegional,
                        constraintMoreResources,
                    )
                ),
                constraintInverseNewWorkspaceCluster
            )
    },
]

export type Constraint = (all: WorkspaceClusterWoTLS[], user: ExtendedUser, workspace: Workspace, instance: WorkspaceInstance) => WorkspaceClusterWoTLS[]

export function invert(c: Constraint): Constraint {
    return (all: WorkspaceClusterWoTLS[], user: ExtendedUser, workspace: Workspace, instance: WorkspaceInstance) => {
        const s = c(all, user, workspace, instance);
        return all.filter(c => !s.find(sc => c.name === sc.name));
    }
}

export function intersect(...cs: Constraint[]): Constraint {
    return (all: WorkspaceClusterWoTLS[], user: ExtendedUser, workspace: Workspace, instance: WorkspaceInstance) => {
        if (cs.length === 0) {
            // no constraints means all clusters match
            return all;
        }

        const sets = cs.map(c => c(all, user, workspace, instance));

        return sets[0].filter(c => sets.slice(1).every(s => s.includes(c)));
    }
}

export function constraintInverseNewWorkspaceCluster(all: WorkspaceClusterWoTLS[], user: ExtendedUser, workspace: Workspace, instance: WorkspaceInstance): WorkspaceClusterWoTLS[] {
    return all.filter(cluster => !cluster.admissionConstraints?.find(constraint => constraint.type === "has-permission"));
}

export function constraintNewWorkspaceCluster(all: WorkspaceClusterWoTLS[], user: ExtendedUser, workspace: Workspace, instance: WorkspaceInstance): WorkspaceClusterWoTLS[] {
    if (!user.rolesOrPermissions?.find(r => r === "new-workspace-cluster")) {
        // if the user cannot access new workspace cluster, we don't have to go and find any
        // which carry this constraint - the user would not be able to access it anyways.
        return [];
    }

    return all.filter(cluster => !!cluster.admissionConstraints?.find(constraint => constraint.type === "has-permission"));
}

export function constraintRegional(all: WorkspaceClusterWoTLS[], user: ExtendedUser, workspace: Workspace, instance: WorkspaceInstance): WorkspaceClusterWoTLS[] {
    // TODO(cw): implement me
    return [];
}

export function constraintMoreResources(all: WorkspaceClusterWoTLS[], user: ExtendedUser, workspace: Workspace, instance: WorkspaceInstance): WorkspaceClusterWoTLS[] {
    // TODO(cw): implement me
    return [];
}
