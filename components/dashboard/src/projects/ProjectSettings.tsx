/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { useLocation } from "react-router";
import { Project, ProjectSettings, Team } from "@gitpod/gitpod-protocol";
import CheckBox from "../components/CheckBox";
import { getGitpodService } from "../service/service";
import { getCurrentTeam, TeamsContext } from "../teams/teams-context";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import PillLabel from "../components/PillLabel";
import { ProjectContext } from "./project-context";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";

export function getProjectSettingsMenu(project?: Project, team?: Team) {
    const teamOrUserSlug = !!team ? "t/" + team.slug : "projects";
    return [
        {
            title: "General",
            link: [`/${teamOrUserSlug}/${project?.slug || project?.name}/settings`],
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
    const { showPersistentVolumeClaimUI } = useContext(FeatureFlagContext);
    const { project, setProject } = useContext(ProjectContext);

    if (!project) return null;

    const updateProjectSettings = (settings: ProjectSettings) => {
        if (!project) return;

        const newSettings = { ...project.settings, ...settings };
        getGitpodService().server.updateProjectPartial({ id: project.id, settings: newSettings });
        setProject({ ...project, settings: newSettings });
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
                checked={project.settings?.useIncrementalPrebuilds ?? false}
                onChange={({ target }) => updateProjectSettings({ useIncrementalPrebuilds: target.checked })}
            />
            <CheckBox
                title={<span>Cancel Prebuilds on Outdated Commits </span>}
                desc={<span>Cancel pending or running prebuilds on the same branch when new commits are pushed.</span>}
                checked={!project.settings?.keepOutdatedPrebuildsRunning}
                onChange={({ target }) => updateProjectSettings({ keepOutdatedPrebuildsRunning: !target.checked })}
            />
            <h3 className="mt-12">Workspace Starts</h3>
            <CheckBox
                title={<span>Incrementally update from old prebuilds</span>}
                desc={
                    <span>
                        Whether new workspaces can be started based on prebuilds that ran on older Git commits and get
                        incrementally updated.
                    </span>
                }
                checked={!!project.settings?.allowUsingPreviousPrebuilds}
                onChange={({ target }) => updateProjectSettings({ allowUsingPreviousPrebuilds: target.checked })}
            />
            {showPersistentVolumeClaimUI && (
                <>
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
                        checked={project.settings?.usePersistentVolumeClaim ?? false}
                        onChange={({ target }) => updateProjectSettings({ usePersistentVolumeClaim: target.checked })}
                    />
                </>
            )}
        </ProjectSettingsPage>
    );
}
