/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project, ProjectSettings } from "@gitpod/gitpod-protocol";
import { useCallback, useContext, useState, Fragment } from "react";
import { useHistory } from "react-router";
import { CheckboxInputField } from "../components/forms/CheckboxInputField";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import PillLabel from "../components/PillLabel";
import { getGitpodService } from "../service/service";
import { ProjectContext, useCurrentProject } from "./project-context";
import { getProjectSettingsMenu, getProjectTabs } from "./projects.routes";
import { Heading2, Subheading } from "../components/typography/headings";
import { RemoveProjectModal } from "./RemoveProjectModal";
import SelectWorkspaceClassComponent from "../components/SelectWorkspaceClassComponent";
import { TextInputField } from "../components/forms/TextInputField";
import { Button } from "../components/Button";
import { useRefreshProjects } from "../data/projects/list-projects-query";
import { useToast } from "../components/toasts/Toasts";
import classNames from "classnames";
import { InputField } from "../components/forms/InputField";
import { SelectInputField } from "../components/forms/SelectInputField";

export function ProjectSettingsPage(props: { project?: Project; children?: React.ReactNode }) {
    return (
        <PageWithSubMenu
            subMenu={getProjectSettingsMenu(props.project)}
            title={props.project?.name || "Loading..."}
            subtitle="Manage project settings and configuration"
            tabs={getProjectTabs(props.project)}
        >
            {props.children}
        </PageWithSubMenu>
    );
}

export default function ProjectSettingsView() {
    const { setProject } = useContext(ProjectContext);
    const { project } = useCurrentProject();
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [projectName, internalSetProjectName] = useState(project?.name || "");
    if (!projectName && project && !isDirty) {
        internalSetProjectName(project.name);
    }
    let badProjectName: string | undefined;
    if (project) {
        badProjectName = projectName.length > 0 ? undefined : "Project name can not be blank.";
        if (projectName.length > 32) {
            badProjectName = "Project name can not be longer than 32 characters.";
        }
    }
    const history = useHistory();
    const refreshProjects = useRefreshProjects();
    const { toast } = useToast();

    const setProjectName = useCallback(
        (projectName: string) => {
            setIsDirty(true);
            internalSetProjectName(projectName);
        },
        [setIsDirty, internalSetProjectName],
    );

    const updateProjectName = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (!project || badProjectName) return;

            await getGitpodService().server.updateProjectPartial({ id: project.id, name: projectName });
            setProject({ ...project, name: projectName });
            refreshProjects(project.teamId);
            toast(`Project ${projectName} updated.`);
        },
        [project, badProjectName, projectName, setProject, refreshProjects, toast],
    );

    const updateProjectSettings = useCallback(
        async (settings: ProjectSettings) => {
            if (!project) return;

            const newSettings = { ...project.settings, ...settings };
            try {
                await getGitpodService().server.updateProjectPartial({ id: project.id, settings: newSettings });
                setProject({ ...project, settings: newSettings });
            } catch (error) {
                toast(error?.message || "Oh no, there was a problem with updating project settings.");
            }
        },
        [project, setProject, toast],
    );

    const setPrebuildBranchStrategy = useCallback(
        async (value: ProjectSettings.PrebuildBranchStrategy) => {
            const prebuildDefaultBranchOnly = value === "defaultBranch";
            await updateProjectSettings({
                prebuildDefaultBranchOnly,
            });
        },
        [updateProjectSettings],
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
        history.push("/projects");
    }, [history]);

    // TODO: Render a generic error screen for when an entity isn't found
    if (!project) return null;

    const enablePrebuilds = Project.isPrebuildsEnabled(project);

    const prebuildBranchStrategy = Project.getPrebuildBranchStrategy(project);

    return (
        <ProjectSettingsPage project={project}>
            <Heading2>Project Name</Heading2>
            <form onSubmit={updateProjectName}>
                <TextInputField
                    hint="The name can be up to 32 characters long."
                    value={projectName}
                    error={badProjectName}
                    onChange={setProjectName}
                />

                <Button className="mt-4" htmlType="submit" disabled={project?.name === projectName || !!badProjectName}>
                    Update Name
                </Button>
            </form>
            <div>
                <Heading2 className="mt-12">Prebuilds</Heading2>
                <CheckboxInputField
                    label="Enable prebuilds"
                    hint={
                        <span>
                            {enablePrebuilds ? (
                                <Fragment>
                                    Prebuilds will run for any <code>before</code> or <code>init</code> tasks.
                                </Fragment>
                            ) : (
                                "Requires permissions to configure repository webhooks."
                            )}{" "}
                            <a
                                className="gp-link"
                                target="_blank"
                                rel="noreferrer"
                                href="https://www.gitpod.io/docs/configure/projects/prebuilds"
                            >
                                Learn more
                            </a>
                        </span>
                    }
                    checked={enablePrebuilds}
                    onChange={(checked) => updateProjectSettings({ enablePrebuilds: checked })}
                />
                {enablePrebuilds && (
                    <>
                        <SelectInputField
                            disabled={!enablePrebuilds}
                            label="Build branches"
                            value={prebuildBranchStrategy}
                            topMargin={false}
                            onChange={(val) => setPrebuildBranchStrategy(val as ProjectSettings.PrebuildBranchStrategy)}
                        >
                            <option value="defaultBranch">Default branch</option>
                            <option value="allBranches">All branches</option>
                            {/* <option value="selectedBranches">Matched by pattern</option> */}
                        </SelectInputField>
                        <InputField label="Workspace machine type" disabled={!enablePrebuilds}>
                            <div className="max-w-md">
                                <SelectWorkspaceClassComponent
                                    disabled={!enablePrebuilds}
                                    selectedWorkspaceClass={project.settings?.workspaceClasses?.prebuild}
                                    onSelectionChange={setWorkspaceClassForPrebuild}
                                />
                            </div>
                        </InputField>
                        <CheckboxInputField
                            label="Enable Incremental Prebuilds"
                            hint={
                                <span>
                                    When possible, use an earlier successful prebuild as a base to create new prebuilds.
                                    This can make your prebuilds significantly faster, especially if they normally take
                                    longer than 10 minutes.{" "}
                                    <a
                                        className="gp-link"
                                        target="_blank"
                                        rel="noreferrer"
                                        href="https://www.gitpod.io/changelog/faster-incremental-prebuilds"
                                    >
                                        Learn more
                                    </a>
                                </span>
                            }
                            disabled={!enablePrebuilds}
                            checked={project.settings?.useIncrementalPrebuilds ?? false}
                            onChange={(checked) => updateProjectSettings({ useIncrementalPrebuilds: checked })}
                        />
                        <CheckboxInputField
                            label="Cancel Prebuilds on Outdated Commits"
                            hint="Cancel pending or running prebuilds on the same branch when new commits are pushed."
                            disabled={!enablePrebuilds}
                            checked={!project.settings?.keepOutdatedPrebuildsRunning}
                            onChange={(checked) => updateProjectSettings({ keepOutdatedPrebuildsRunning: !checked })}
                        />
                        <CheckboxInputField
                            label={
                                <span>
                                    Use Last Successful Prebuild{" "}
                                    <PillLabel type="warn" className="font-semibold mt-2 ml-2 py-0.5 px-2 self-center">
                                        Alpha
                                    </PillLabel>
                                </span>
                            }
                            hint="Skip waiting for prebuilds in progress and use the last successful prebuild from previous
                    commits on the same branch."
                            disabled={!enablePrebuilds}
                            checked={!!project.settings?.allowUsingPreviousPrebuilds}
                            onChange={(checked) =>
                                updateProjectSettings({
                                    allowUsingPreviousPrebuilds: checked,
                                    // we are disabling prebuild cancellation when incremental workspaces are enabled
                                    keepOutdatedPrebuildsRunning:
                                        checked || project?.settings?.keepOutdatedPrebuildsRunning,
                                })
                            }
                        />
                        <div className="flex mt-4 max-w-2xl">
                            <div className="flex flex-col ml-6">
                                <label
                                    htmlFor="prebuildNthCommit"
                                    className={classNames(
                                        "text-sm font-semibold cursor-pointer tracking-wide",
                                        !enablePrebuilds || !project.settings?.allowUsingPreviousPrebuilds
                                            ? "text-gray-400 dark:text-gray-400"
                                            : "text-gray-600 dark:text-gray-100",
                                    )}
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
                                            prebuildEveryNthCommit:
                                                Math.abs(Math.min(Number.parseInt(target.value), 100)) || 0,
                                        })
                                    }
                                />
                                <div className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                                    The number of commits that are skipped between prebuilds.
                                </div>
                            </div>
                        </div>
                    </>
                )}
                <div>
                    <Heading2 className="mt-12">Workspaces</Heading2>
                    <Subheading>Choose the workspace machine type for your workspaces.</Subheading>
                    <div className="max-w-md mt-2">
                        <SelectWorkspaceClassComponent
                            selectedWorkspaceClass={project.settings?.workspaceClasses?.regular}
                            onSelectionChange={setWorkspaceClass}
                        />
                    </div>
                </div>
            </div>
            <div>
                <Heading2 className="mt-12">Remove Project</Heading2>
                <Subheading className="pb-4 max-w-md">
                    This will delete the project and all project-level environment variables you've set for this
                    project.
                </Subheading>
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
