/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol";
import { TabEntry } from "../components/Header";

export const projectsPathMain = "/projects";
export const projectsPathMainWithParams = [projectsPathMain, ":projectName", ":resourceOrPrebuild?"].join("/");

export const projectsPathInstallGitHubApp = "/install-github-app";

export function getProjectTabs(project: Project | undefined): TabEntry[] {
    if (!project) {
        return [];
    }
    return [
        {
            title: "Branches",
            link: `/projects/${project.id}`,
        },
        {
            title: "Prebuilds",
            link: `/projects/${project.id}/prebuilds`,
        },
        {
            title: "Settings",
            link: `/projects/${project.id}/settings`,
            alternatives: getProjectSettingsMenu(project).flatMap((e) => e.link),
        },
    ];
}

export function getProjectSettingsMenu(project?: Project) {
    const slug = project?.id ?? "unknown";
    return [
        {
            title: "General",
            link: [`/projects/${slug}/settings`],
        },
        {
            title: "Variables",
            link: [`/projects/${slug}/variables`],
        },
    ];
}
