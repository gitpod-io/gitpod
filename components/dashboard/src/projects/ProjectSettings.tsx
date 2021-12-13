/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { useLocation, useRouteMatch } from "react-router";
import { Project, Team } from "@gitpod/gitpod-protocol";
import CheckBox from "../components/CheckBox";
import { getGitpodService } from "../service/service";
import { getCurrentTeam, TeamsContext } from "../teams/teams-context";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import PillLabel from "../components/PillLabel";

export function getProjectSettingsMenu(project?: Project, team?: Team) {
    const teamOrUserSlug = !!team ? 't/' + team.slug : 'projects';
    return [
        {
            title: 'General',
            link: [`/${teamOrUserSlug}/${project?.slug || project?.name}/settings`],
        },
        {
            title: 'Configuration',
            link: [`/${teamOrUserSlug}/${project?.slug || project?.name}/configure`],
        },
    ];
}

export default function () {
    const location = useLocation();
    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);
    const match = useRouteMatch<{ team: string, resource: string }>("/(t/)?:team/:resource");
    const projectSlug = match?.params?.resource;
    const [ project, setProject ] = useState<Project | undefined>();

    const [ isLoading, setIsLoading ] = useState<boolean>(true);
    const [ isIncrementalPrebuildsEnabled, setIsIncrementalPrebuildsEnabled ] = useState<boolean>(false);

    useEffect(() => {
        if (!teams || !projectSlug) {
            return;
        }
        (async () => {
            const projects = (!!team
                ? await getGitpodService().server.getTeamProjects(team.id)
                : await getGitpodService().server.getUserProjects());

            // Find project matching with slug, otherwise with name
            const project = projectSlug && projects.find(p => p.slug ? p.slug === projectSlug : p.name === projectSlug);
            if (!project) {
                return;
            }
            setProject(project);
        })();
    }, [ projectSlug, team, teams ]);

    useEffect(() => {
        if (!project) {
            return;
        }
        setIsLoading(false);
        setIsIncrementalPrebuildsEnabled(!!project.settings?.useIncrementalPrebuilds);
    }, [ project ]);

    const toggleIncrementalPrebuilds = async () => {
        if (!project) {
            return;
        }
        setIsLoading(true);
        try {
            await getGitpodService().server.updateProjectPartial({
                id: project.id,
                settings: {
                    useIncrementalPrebuilds: !isIncrementalPrebuildsEnabled,
                }
            });
            setIsIncrementalPrebuildsEnabled(!isIncrementalPrebuildsEnabled);
        } finally {
            setIsLoading(false);
        }
    }

    return <PageWithSubMenu subMenu={getProjectSettingsMenu(project, team)} title="Settings" subtitle="Manage project settings and configuration">
        <h3>Incremental Prebuilds</h3>
        <CheckBox
            title={<span>Enable Incremental Prebuilds <PillLabel type="warn" className="font-semibold mt-2 py-0.5 px-2 self-center">Beta</PillLabel></span>}
            desc={<span>When possible, use an earlier successful prebuild as a base to create new prebuilds. This can make your prebuilds significantly faster, especially if they normally take longer than 10 minutes. <a className="gp-link" href="https://www.gitpod.io/changelog/faster-incremental-prebuilds">Learn more</a></span>}
            checked={isIncrementalPrebuildsEnabled}
            disabled={isLoading}
            onChange={toggleIncrementalPrebuilds} />
    </PageWithSubMenu>;
}