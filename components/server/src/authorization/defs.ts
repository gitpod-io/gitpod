/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export const OrganizationResourceType = "organization";
export const ProjectResourceType = "project";
export const UserResourceType = "user";

export type OrganizationPermission =
    | "membership"
    | "read_info"
    | "write_info"
    | "read_members"
    | "write_members"
    | "create_project";
export type ProjectPermission = "write_info" | "read_info";
export type Permission = OrganizationPermission;

export type ResourceType = typeof OrganizationResourceType | typeof ProjectResourceType | typeof UserResourceType;
