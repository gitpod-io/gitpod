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
                title={<span>Enable Incremental Prebuilds </span>}
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
            <CheckBox
                title={
                    <span>
                        Use Last Successful Prebuild{" "}
                        <PillLabel type="warn" className="font-semibold mt-2 ml-2 py-0.5 px-2 self-center">
                            Alpha
                        </PillLabel>
                    </span>
                }
                desc={
                    <span>
                        Skip waiting for prebuilds in progress and use the last successful prebuild from previous
                        commits on the same branch.
                    </span>
                }
                checked={!!project.settings?.allowUsingPreviousPrebuilds}
                onChange={({ target }) =>
                    updateProjectSettings({
                        allowUsingPreviousPrebuilds: target.checked,
                        // we are disabling prebuild cancellation when incremental workspaces are enabled
                        keepOutdatedPrebuildsRunning: target.checked || project?.settings?.keepOutdatedPrebuildsRunning,
                    })
                }
            />
            <div className="flex mt-4 max-w-2xl">
                <div className="flex flex-col ml-6">
                    <label
                        htmlFor="prebuildNthCommit"
                        className="text-gray-800 dark:text-gray-100 text-md font-semibold cursor-pointer tracking-wide"
                    >
                        Skip Prebuilds
                    </label>
                    <input
                        type="number"
                        id="prebuildNthCommit"
                        min="0"
                        max="100"
                        step="5"
                        className="mt-2"
                        disabled={!project.settings?.allowUsingPreviousPrebuilds}
                        value={
                            project.settings?.prebuildEveryNthCommit === undefined
                                ? 0
                                : project.settings?.prebuildEveryNthCommit
                        }
                        onChange={({ target }) =>
                            updateProjectSettings({
                                prebuildEveryNthCommit: Math.abs(Math.min(Number.parseInt(target.value), 100)) || 0,
                            })
                        }
                    />
                    <div className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                        The number of commits that are skipped between prebuilds.
                    </div>
                </div>
            </div>

            {showPersistentVolumeClaimUI && (
                <>
                    <br></br>
                    <h3 className="mt-12">Workspaces</h3>
                    <CheckBox
                        title={
                            <span>
                                Enable Persistent Volume Claim{" "}
                                <PillLabel type="warn" className="font-semibold mt-2 ml-2 py-0.5 px-2 self-center">
                                    Alpha
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
