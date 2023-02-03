/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export type OrganizationOperation =
    // A not yet implemented operation at this time. This exists such that we can be explicit about what
    // we have not yet migrated to fine-grained-permissions.
    | "not_implemented"

    // Ability to perform write actions an Organization, and all sub-resources of the organization.
    | "org_write"

    // Ability to update Organization metadata - name, and other general info.
    | "org_metadata_write"
    // Ability to read Organization metadata - name, and other general info.
    | "org_metadata_read"

    // Ability to access information about team members.
    | "org_members_read"
    // Ability to add, or remove, team members.
    | "org_members_write"

    // Ability to read projects in an Organization.
    | "org_project_read"
    // Ability to create/update/delete projects in an Organization.
    | "org_project_write"

    // Ability to create/update/delete Organization Auth Providers.
    | "org_authprovider_write"
    // Ability to read Organization Auth Providers.
    | "org_authprovider_read";
