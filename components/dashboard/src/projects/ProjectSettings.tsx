/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useHistory } from "react-router";
import { Project, ProjectSettings } from "@gitpod/gitpod-protocol";
import CheckBox from "../components/CheckBox";
import { getGitpodService } from "../service/service";
import { getCurrentTeam, TeamsContext } from "../teams/teams-context";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import PillLabel from "../components/PillLabel";
import { ProjectContext } from "./project-context";
import SelectWorkspaceClass from "../settings/selectClass";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import Alert from "../components/Alert";
import { Link } from "react-router-dom";
import { RemoveProjectModal } from "./RemoveProjectModal";
import { Team } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_pb";

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
    const { project, setProject } = useContext(ProjectContext);
    const [billingMode, setBillingMode] = useState<BillingMode | undefined>(undefined);
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(useLocation(), teams);
    const history = useHistory();

    useEffect(() => {
        if (team) {
            getGitpodService().server.getBillingModeForTeam(team.id).then(setBillingMode);
        } else {
            getGitpodService().server.getBillingModeForUser().then(setBillingMode);
        }
    }, [team]);

    const updateProjectSettings = useCallback(
        (settings: ProjectSettings) => {
            if (!project) return;

            const newSettings = { ...project.settings, ...settings };
            getGitpodService().server.updateProjectPartial({ id: project.id, settings: newSettings });
            setProject({ ...project, settings: newSettings });
        },
        [project, setProject],
    );

    const setWorkspaceClass = useCallback(
        async (value: string) => {
            if (!project) {
                return value;
            }
            const before = project.settings?.workspaceClasses?.regular;
            updateProjectSettings({ workspaceClasses: { ...project.settings?.workspaceClasses, regular: value } });
            return before;
        },
        [project, updateProjectSettings],
    );

    const setWorkspaceClassForPrebuild = useCallback(
        async (value: string) => {
            if (!project) {
                return value;
            }
            const before = project.settings?.workspaceClasses?.prebuild;
            updateProjectSettings({ workspaceClasses: { ...project.settings?.workspaceClasses, prebuild: value } });
            return before;
        },
        [project, updateProjectSettings],
    );

    const onProjectRemoved = useCallback(() => {
        // if there's a current team, navigate to team projects
        if (team) {
            history.push(`/t/${team.slug}/projects`);
        } else {
            history.push("/projects");
        }
    }, [history, team]);

    // TODO: Render a generic error screen for when an entity isn't found
    if (!project) return null;

    return (
        <ProjectSettingsPage project={project}>
            <h3>Prebuilds</h3>
            <p className="text-base text-gray-500 dark:text-gray-400">
                Choose the workspace machine type for your prebuilds.
            </p>
            {BillingMode.canSetWorkspaceClass(billingMode) ? (
                <SelectWorkspaceClass
                    workspaceClass={project.settings?.workspaceClasses?.prebuild}
                    setWorkspaceClass={setWorkspaceClassForPrebuild}
                />
            ) : (
                <Alert type="message" className="mt-4">
                    <div className="flex flex-col">
                        <span>
                            To access{" "}
                            <a
                                className="gp-link"
                                href="https://www.gitpod.io/docs/configure/workspaces/workspace-classes"
                            >
                                large workspaces
                            </a>{" "}
                            and{" "}
                            <a className="gp-link" href="https://www.gitpod.io/docs/configure/billing/pay-as-you-go">
                                pay-as-you-go
                            </a>
                            , first cancel your existing plan.
                        </span>
                        <Link className="mt-2" to={project.teamId ? "../billing" : "/plans"}>
                            <button>Go to {project.teamId ? "Team" : "Personal"} Billing</button>
                        </Link>
                    </div>
                </Alert>
            )}
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
            <div>
                <h3 className="mt-12">Workspaces</h3>
                <p className="text-base text-gray-500 dark:text-gray-400">
                    Choose the workspace machine type for your workspaces.
                </p>
                {BillingMode.canSetWorkspaceClass(billingMode) ? (
                    <SelectWorkspaceClass
                        workspaceClass={project.settings?.workspaceClasses?.regular}
                        setWorkspaceClass={setWorkspaceClass}
                    />
                ) : (
                    <Alert type="message" className="mt-4">
                        <div className="flex flex-col">
                            <span>
                                To access{" "}
                                <a
                                    className="gp-link"
                                    href="https://www.gitpod.io/docs/configure/workspaces/workspace-classes"
                                >
                                    large workspaces
                                </a>{" "}
                                and{" "}
                                <a
                                    className="gp-link"
                                    href="https://www.gitpod.io/docs/configure/billing/pay-as-you-go"
                                >
                                    pay-as-you-go
                                </a>
                                , first cancel your existing plan.
                            </span>
                            <Link className="mt-2" to={project.teamId ? "../billing" : "/plans"}>
                                <button>Go to {project.teamId ? "Team" : "Personal"} Billing</button>
                            </Link>
                        </div>
                    </Alert>
                )}
            </div>
            <div className="">
                <h3 className="mt-12">Remove Project</h3>
                <p className="text-base text-gray-500 dark:text-gray-400 pb-4">
                    This will delete the project and all project-level environment variables you've set for this
                    project.
                </p>
                <button className="danger secondary" onClick={() => setShowRemoveModal(true)}>
                    Remove Project
                </button>
            </div>
            {showRemoveModal && (
                <RemoveProjectModal
                    project={project}
                    onRemoved={onProjectRemoved}
                    onClose={() => setShowRemoveModal(false)}
                />
            )}
        </ProjectSettingsPage>
    );
}
