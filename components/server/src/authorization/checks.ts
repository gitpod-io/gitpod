/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { Permission, ResourceType, objectRef, subject } from "./definitions";

const FULLY_CONSISTENT = v1.Consistency.create({
    requirement: {
        oneofKind: "fullyConsistent",
        fullyConsistent: true,
    },
});

type SubjectResourceCheckFn = (subjectID: string, resourceID: string) => v1.CheckPermissionRequest;

function check(subjectT: ResourceType, op: Permission, resourceT: ResourceType): SubjectResourceCheckFn {
    return (subjectID, resourceID) =>
        v1.CheckPermissionRequest.create({
            subject: subject(subjectT, subjectID),
            permission: op,
            resource: objectRef(resourceT, resourceID),
            consistency: FULLY_CONSISTENT,
        });
}

export const ReadOrganizationInfo = check("user", "read_info", "organization");
export const WriteOrganizationInfo = check("user", "write_info", "organization");

export const ReadOrganizationMembers = check("user", "read_members", "organization");
export const WriteOrganizationMembers = check("user", "write_members", "organization");

export const ReadOrganizationSettings = check("user", "read_settings", "organization");
export const WriteOrganizationSettings = check("user", "write_settings", "organization");

export const ReadGitProvider = check("user", "read_git_provider", "organization");
export const WriteGitProvider = check("user", "write_git_provider", "organization");

export const LeaveOrganization = check("user", "leave", "organization");
