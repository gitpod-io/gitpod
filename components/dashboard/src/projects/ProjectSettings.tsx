/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Project, ProjectSettings, Team } from "@gitpod/gitpod-protocol";
import CheckBox from "../components/CheckBox";
import { getGitpodService } from "../service/service";
import { getCurrentTeam, TeamsContext } from "../teams/teams-context";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import PillLabel from "../components/PillLabel";
import { ProjectContext } from "./project-context";
import { getExperimentsClient } from "./../experiments/client";
import { UserContext } from "../user-context";

export function getProjectSettingsMenu(project?: Project, team?: Team) {
    const teamOrUserSlug = !!team ? "t/" + team.slug : "projects";
    return [
        {
            title: "General",
            link: [`/${teamOrUserSlug}/${project?.slug || project?.name}/settings`],
        },
        {
            title: "Configuration",
            link: [`/${teamOrUserSlug}/${project?.slug || project?.name}/configure`],
        },
        {
            title: "Variables",
            link: [`/${teamOrUserSlug}/${project?.slug || project?.name}/variables`],
        },
    ];
}

export function ProjectSettingsPage(props: { project?: Project; children?: React.ReactNode }) {
    const location = useLocation();
    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);

    return (
        <PageWithSubMenu
            subMenu={getProjectSettingsMenu(props.project, team)}
            title="Settings"
            subtitle="Manage project settings and configuration"
        >
            {props.children}
        </PageWithSubMenu>
    );
}

export default function () {
    const { user } = useContext(UserContext);
    const { project } = useContext(ProjectContext);
    const location = useLocation();
    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);

    const [isShowPersistentVolumeClaim, setIsShowPersistentVolumeClaim] = useState<boolean>(false);
    const [projectSettings, setProjectSettings] = useState<ProjectSettings>({});

    useEffect(() => {
        if (!project) {
            return;
        }
        setProjectSettings({ ...project.settings });
        (async () => {
            if (!user) {
                return;
            }
            const showPersistentVolumeClaim = await getExperimentsClient().getValueAsync(
                "persistent_volume_claim",
                false,
                {
                    user,
                    projectId: project?.id,
                    teamId: team?.id,
                    teamName: team?.name,
                    teams,
                },
            );
            setIsShowPersistentVolumeClaim(showPersistentVolumeClaim);
        })();
    }, [project, team, teams]);

    const updateProjectSettings = () => {
        if (!project) {
            return;
        }
        setProjectSettings({
            ...projectSettings,
        });
        return getGitpodService().server.updateProjectPartial({ id: project.id, settings: projectSettings });
    };

    const toggleIncrementalPrebuilds = async () => {
        projectSettings.useIncrementalPrebuilds = !projectSettings.useIncrementalPrebuilds;
        updateProjectSettings();
    };

    const toggleCancelOutdatedPrebuilds = async () => {
        projectSettings.keepOutdatedPrebuildsRunning = !projectSettings.keepOutdatedPrebuildsRunning;
        updateProjectSettings();
    };

    const togglePersistentVolumeClaim = async () => {
        projectSettings.usePersistentVolumeClaim = !projectSettings.usePersistentVolumeClaim;
        updateProjectSettings();
    };

    return (
        <ProjectSettingsPage project={project}>
            <h3>Prebuilds</h3>
            <CheckBox
                title={
                    <span>
                        Enable Incremental Prebuilds{" "}
                        <PillLabel type="warn" className="font-semibold mt-2 ml-2 py-0.5 px-2 self-center">
                            Beta
                        </PillLabel>
                    </span>
                }
                desc={
                    <span>
                        When possible, use an earlier successful prebuild as a base to create new prebuilds. This can
                        make your prebuilds significantly faster, especially if they normally take longer than 10
                        minutes.{" "}
                        <a className="gp-link" href="https://www.gitpod.io/changelog/faster-incremental-prebuilds">
                            Learn more
                        </a>
                    </span>
                }
                checked={!!projectSettings.useIncrementalPrebuilds}
                onChange={toggleIncrementalPrebuilds}
            />
            <CheckBox
                title={<span>Cancel Prebuilds on Outdated Commits </span>}
                desc={<span>Cancel pending or running prebuilds on the same branch when new commits are pushed.</span>}
                checked={!projectSettings.keepOutdatedPrebuildsRunning}
                onChange={toggleCancelOutdatedPrebuilds}
            />
            <br></br>
            <h3 className="mt-12">Workspace Persistence</h3>
            <CheckBox
                title={
                    <span>
                        Enable Persistent Volume Claim{" "}
                        <PillLabel type="warn" className="font-semibold mt-2 ml-2 py-0.5 px-2 self-center">
                            Experimental
                        </PillLabel>
                    </span>
                }
                desc={<span>Experimental feature that is still under development.</span>}
                checked={!!projectSettings.usePersistentVolumeClaim}
                disabled={!isShowPersistentVolumeClaim}
                onChange={togglePersistentVolumeClaim}
            />
        </ProjectSettingsPage>
    );
}
