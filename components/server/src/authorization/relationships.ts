/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamMemberRole } from "@gitpod/gitpod-protocol";
import { objectRef, relationship, subject } from "./definitions";
import { v1 } from "@authzed/authzed-node";

export function organizationRole(orgID: string, userID: string, role: TeamMemberRole): v1.WriteRelationshipsRequest {
    return role === "owner" ? organizationOwnerRole(orgID, userID) : organizationMemberRole(orgID, userID);
}

export function organizationOwnerRole(orgID: string, userID: string): v1.WriteRelationshipsRequest {
    return v1.WriteRelationshipsRequest.create({
        updates: [
            v1.RelationshipUpdate.create({
                operation: v1.RelationshipUpdate_Operation.TOUCH,
                relationship: relationship(objectRef("organization", orgID), "owner", subject("user", userID)),
            }),
            v1.RelationshipUpdate.create({
                // If the user does not have existing member, the operation will No-op
                operation: v1.RelationshipUpdate_Operation.DELETE,
                relationship: relationship(objectRef("organization", orgID), "member", subject("user", userID)),
            }),
        ],
    });
}

export function organizationMemberRole(orgID: string, userID: string): v1.WriteRelationshipsRequest {
    return v1.WriteRelationshipsRequest.create({
        updates: [
            v1.RelationshipUpdate.create({
                operation: v1.RelationshipUpdate_Operation.TOUCH,
                relationship: relationship(objectRef("organization", orgID), "member", subject("user", userID)),
            }),
            v1.RelationshipUpdate.create({
                // If the user does not have existing owner, the operation will No-op
                operation: v1.RelationshipUpdate_Operation.DELETE,
                relationship: relationship(objectRef("organization", orgID), "owner", subject("user", userID)),
            }),
        ],
    });
}
