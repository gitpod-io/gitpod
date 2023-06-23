/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";

export const OrganizationResourceType = "organization";
export const ProjectResourceType = "project";
export const UserResourceType = "user";

export type OrganizationRelation = "owner" | "member";
export type ProjectRelation = "org";
export type Relation = OrganizationRelation | ProjectRelation;

export type OrganizationPermission =
    | "read_info"
    | "write_info"
    | "read_members"
    | "write_members"
    | "leave"
    | "delete"
    | "read_settings"
    | "write_settings"
    | "create_project";
export type ProjectPermission = "write_info" | "read_info";
export type Permission = OrganizationPermission;

export type ResourceType = typeof OrganizationResourceType | typeof ProjectResourceType | typeof UserResourceType;

export function objectRef(type: ResourceType, id: string): v1.ObjectReference {
    return v1.ObjectReference.create({
        objectId: id,
        objectType: type,
    });
}

export function relationship(
    res: v1.ObjectReference,
    relation: Relation,
    subject: v1.SubjectReference,
): v1.Relationship {
    return v1.Relationship.create({
        relation: relation,
        resource: res,
        subject: subject,
    });
}

export function subject(type: ResourceType, id: string, relation?: Relation | Permission): v1.SubjectReference {
    return v1.SubjectReference.create({
        object: objectRef(type, id),
        optionalRelation: relation,
    });
}
