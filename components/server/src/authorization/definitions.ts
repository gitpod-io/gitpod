/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export const InstallationID = "1";
export const InstallationResourceType = "installation";
export const OrganizationResourceType = "organization";
export const ProjectResourceType = "project";
export const UserResourceType = "user";
export type ResourceType =
    | typeof InstallationResourceType
    | typeof OrganizationResourceType
    | typeof ProjectResourceType
    | typeof UserResourceType;

export type InstallationRelation = "user" | "admin";
export type OrganizationRelation = "installation" | "owner" | "member";
export type ProjectRelation = "org" | "editor" | "viewer";
export type Relation = InstallationRelation | OrganizationRelation | ProjectRelation;

export type InstallationPermission = "create_organization";
export type OrganizationPermission =
    | "read_info"
    | "write_info"
    | "read_members"
    | "invite_members"
    | "write_members"
    | "leave"
    | "delete"
    | "create_project"
    | "read_settings"
    | "write_settings"
    | "read_git_provider"
    | "write_git_provider"
    | "read_billing"
    | "write_billing"
    | "write_billing_admin";
export type ProjectPermission = "write_info" | "read_info" | "delete";
export type Permission = OrganizationPermission;
