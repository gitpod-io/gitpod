/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export const OrganizationResourceType = "organization";
export const ProjectResourceType = "project";
export const UserResourceType = "user";
export type ResourceType = typeof OrganizationResourceType | typeof ProjectResourceType | typeof UserResourceType;

export type OrganizationRelation = "owner" | "member";
export type ProjectRelation = "org";
export type Relation = OrganizationRelation | ProjectRelation;

export type OrganizationPermission =
    | "read_info"
    | "write_info"
    | "read_members"
    | "invite_members"
    | "write_members"
    | "leave"
    | "delete"
    | "read_settings"
    | "write_settings"
    | "read_git_provider"
    | "write_git_provider"
    | "read_billing"
    | "write_billing"
    | "create_project";
export type ProjectPermission = "write_info" | "read_info";
export type Permission = OrganizationPermission;
