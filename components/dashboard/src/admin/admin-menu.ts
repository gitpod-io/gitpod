/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export function getAdminMenu() {
    return [
        {
            title: "Users",
            link: ["/admin/users", "/admin"],
        },
        {
            title: "Workspaces",
            link: ["/admin/workspaces"],
        },
        {
            title: "Projects",
            link: ["/admin/projects"],
        },
        {
            title: "Teams",
            link: ["/admin/teams"],
        },
        {
            title: "Blocked Repositories",
            link: ["/admin/blocked-repositories"],
        },
        {
            title: "License",
            link: ["/admin/license"],
        },
        {
            title: "Settings",
            link: ["/admin/settings"],
        },
    ];
}
