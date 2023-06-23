/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrgMemberRole, TeamMemberRole } from "@gitpod/gitpod-protocol";
import { objectRef, relationship, subject } from "./definitions";
import { v1 } from "@authzed/authzed-node";

export function organizationRole(orgID: string, userID: string, role: TeamMemberRole): v1.RelationshipUpdate[] {
    return role === "owner" ? addOrganizationOwnerRole(orgID, userID) : addOrganizationMemberRole(orgID, userID);
}

export function addOrganizationOwnerRole(orgID: string, userID: string): v1.RelationshipUpdate[] {
    return [
        v1.RelationshipUpdate.create({
            operation: v1.RelationshipUpdate_Operation.TOUCH,
            relationship: relationship(objectRef("organization", orgID), "owner", subject("user", userID)),
        }),
        v1.RelationshipUpdate.create({
            operation: v1.RelationshipUpdate_Operation.TOUCH,
            relationship: relationship(objectRef("organization", orgID), "member", subject("user", userID)),
        }),
    ];
}

export function addOrganizationMemberRole(orgID: string, userID: string): v1.RelationshipUpdate[] {
    return [
        v1.RelationshipUpdate.create({
            operation: v1.RelationshipUpdate_Operation.TOUCH,
            relationship: relationship(objectRef("organization", orgID), "member", subject("user", userID)),
        }),
    ];
}

export function deleteOwnerRole(orgID: string, userID: string): v1.RelationshipUpdate[] {
    return [
        v1.RelationshipUpdate.create({
            operation: v1.RelationshipUpdate_Operation.DELETE,
            relationship: relationship(objectRef("organization", orgID), "owner", subject("user", userID)),
        }),
    ];
}

export function removeUserFromOrg(orgID: string, userID: string): v1.RelationshipUpdate[] {
    return [
        v1.RelationshipUpdate.create({
            operation: v1.RelationshipUpdate_Operation.DELETE,
            relationship: relationship(objectRef("organization", orgID), "member", subject("user", userID)),
        }),
        v1.RelationshipUpdate.create({
            operation: v1.RelationshipUpdate_Operation.DELETE,
            relationship: relationship(objectRef("organization", orgID), "owner", subject("user", userID)),
        }),
    ];
}

export function deleteOrganization(orgID: string): v1.DeleteRelationshipsRequest {
    return v1.DeleteRelationshipsRequest.create({
        relationshipFilter: v1.RelationshipFilter.create({
            resourceType: "organization",
            optionalResourceId: orgID,
        }),
    });
}

export function populateOrganization(
    orgID: string,
    members: { id: string; role: OrgMemberRole }[],
): v1.RelationshipUpdate[] {
    const updates: v1.RelationshipUpdate[] = [];

    for (let member of members) {
        updates.concat(organizationRole(orgID, member.id, member.role));
    }

    return updates;
}

export function writeRequest(
    updates: v1.RelationshipUpdate[],
    preconditions?: v1.Precondition[],
): v1.WriteRelationshipsRequest {
    return v1.WriteRelationshipsRequest.create({
        updates,
        optionalPreconditions: preconditions,
    });
}
