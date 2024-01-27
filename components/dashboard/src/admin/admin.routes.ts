/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import { TabEntry } from "../components/Header";

export function getAdminTabs(): TabEntry[] {
    return [
        {
            title: "Users",
            link: "/admin/users",
            alternatives: ["/admin"],
        },
        {
            title: "Workspaces",
            link: "/admin/workspaces",
        },
        {
            title: "Projects",
            link: "/admin/projects",
        },
        {
            title: "Organizations",
            link: "/admin/orgs",
        },
        {
            title: "Blocked Repositories",
            link: "/admin/blocked-repositories",
        },
        {
            title: "Blocked Email Domains",
            link: "/admin/blocked-email-domains",
        },
    ];
}
