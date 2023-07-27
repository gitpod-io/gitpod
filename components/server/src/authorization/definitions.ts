/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export const InstallationID = "1";
export type ResourceType = UserResourceType | InstallationResourceType | OrganizationResourceType | ProjectResourceType;

export type Relation = UserRelation | InstallationRelation | OrganizationRelation | ProjectRelation;

export type Permission = UserPermission | InstallationPermission | OrganizationPermission | ProjectPermission;

export type UserResourceType = "user";

export type UserRelation = "self" | "container";

export type UserPermission = "read_info" | "write_info" | "suspend" | "make_admin";

export type InstallationResourceType = "installation";

export type InstallationRelation = "member" | "admin";

export type InstallationPermission = "create_organization";

export type OrganizationResourceType = "organization";

export type OrganizationRelation = "installation" | "member" | "owner";

export type OrganizationPermission =
    | "installation_admin"
    | "read_info"
    | "write_info"
    | "delete"
    | "read_settings"
    | "write_settings"
    | "read_members"
    | "invite_members"
    | "write_members"
    | "leave"
    | "create_project"
    | "read_git_provider"
    | "write_git_provider"
    | "read_billing"
    | "write_billing"
    | "write_billing_admin";

export type ProjectResourceType = "project";

export type ProjectRelation = "org" | "editor" | "viewer";

export type ProjectPermission = "read_info" | "write_info" | "delete";
