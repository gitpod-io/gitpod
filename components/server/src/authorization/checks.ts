/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { ResourceType, SubjectType } from "./perms";

const FULLY_CONSISTENT = v1.Consistency.create({
    requirement: {
        oneofKind: "fullyConsistent",
        fullyConsistent: true,
    },
});

type SubjectResourceCheckFn = (subjectID: string, resourceID: string) => v1.CheckPermissionRequest;

function check(subjectT: SubjectType, op: string, resourceT: ResourceType): SubjectResourceCheckFn {
    return (subjectID, resourceID) =>
        v1.CheckPermissionRequest.create({
            subject: v1.SubjectReference.create({
                object: v1.ObjectReference.create({
                    objectId: subjectID,
                    objectType: subjectT,
                }),
            }),
            permission: op,
            resource: v1.ObjectReference.create({
                objectId: resourceID,
                objectType: resourceT,
            }),
            consistency: FULLY_CONSISTENT,
        });
}

export const ReadOrganizationMetadata = check("user", "organization_metadata_read", "organization");
export const WriteOrganizationMetadata = check("user", "organization_metadata_write", "organization");

export const ReadOrganizationMembers = check("user", "organization_members_read", "organization");
export const WriteOrganizationMembers = check("user", "organization_members_write", "organization");
