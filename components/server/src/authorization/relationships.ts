/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { objectRef, relationship, subject } from "./definitions";
import { v1 } from "@authzed/authzed-node";

export function organizationOwnerRole(orgID: string, userID: string): v1.RelationshipUpdate[] {
    return [
        v1.RelationshipUpdate.create({
            operation: v1.RelationshipUpdate_Operation.TOUCH,
            relationship: relationship(objectRef("organization", orgID), "owner", subject("user", userID)),
        }),
        v1.RelationshipUpdate.create({
            // If the user does not have existing member, the operation will No-op
            operation: v1.RelationshipUpdate_Operation.DELETE,
            relationship: relationship(objectRef("organization", orgID), "member", subject("user", userID)),
        }),
    ];
}
