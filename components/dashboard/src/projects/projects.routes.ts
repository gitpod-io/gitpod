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
export const projectsPathNew = "/new";

export function getProjectTabs(project: Project | undefined): TabEntry[] {
    if (!project) {
        return [];
    }
    const projectSlug = Project.slug(project);
    return [
        {
            title: "Branches",
            link: `/projects/${projectSlug}`,
        },
        {
            title: "Prebuilds",
            link: `/projects/${projectSlug}/prebuilds`,
        },
        {
            title: "Settings",
            link: `/projects/${projectSlug}/settings`,
            alternatives: getProjectSettingsMenu(project).flatMap((e) => e.link),
        },
    ];
}

export function getProjectSettingsMenu(project?: Project) {
    const slug = project ? Project.slug(project) : "unknown";
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
