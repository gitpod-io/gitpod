/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Project, Team } from "@gitpod/gitpod-protocol";
import CheckBox from "../components/CheckBox";
import { getGitpodService } from "../service/service";
import { getCurrentTeam, TeamsContext } from "../teams/teams-context";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import PillLabel from "../components/PillLabel";
import { ProjectContext } from "./project-context";

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
        {
            title: 'Variables',
            link: [`/${teamOrUserSlug}/${project?.slug || project?.name}/variables`],
        },
    ];
}

export function ProjectSettingsPage(props: { project?: Project, children?: React.ReactNode }) {
    const location = useLocation();
    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);

    return <PageWithSubMenu subMenu={getProjectSettingsMenu(props.project, team)} title="Settings" subtitle="Manage project settings and configuration">
        {props.children}
    </PageWithSubMenu>
}

export default function () {
    const { project } = useContext(ProjectContext);

    const [ isLoading, setIsLoading ] = useState<boolean>(true);
    const [ isIncrementalPrebuildsEnabled, setIsIncrementalPrebuildsEnabled ] = useState<boolean>(false);

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

    return <ProjectSettingsPage project={project}>
        <h3>Incremental Prebuilds</h3>
        <CheckBox
            title={<span>Enable Incremental Prebuilds <PillLabel type="warn" className="font-semibold mt-2 py-0.5 px-2 self-center">Beta</PillLabel></span>}
            desc={<span>When possible, use an earlier successful prebuild as a base to create new prebuilds. This can make your prebuilds significantly faster, especially if they normally take longer than 10 minutes. <a className="gp-link" href="https://www.gitpod.io/changelog/faster-incremental-prebuilds">Learn more</a></span>}
            checked={isIncrementalPrebuildsEnabled}
            disabled={isLoading}
            onChange={toggleIncrementalPrebuilds} />
    </ProjectSettingsPage>;
}