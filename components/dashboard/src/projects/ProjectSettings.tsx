/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project, ProjectSettings, PrebuildSettings } from "@gitpod/gitpod-protocol";
import { useCallback, useContext, useState, Fragment, useMemo, useEffect } from "react";
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
import debounce from "lodash.debounce";

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
    const [prebuildBranchPattern, setPrebuildBranchPattern] = useState("");

    useEffect(() => {
        if (!project) {
            return;
        }
        setPrebuildBranchPattern(project?.settings?.prebuilds?.branchMatchingPattern || "");
    }, [project]);

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

            const oldSettings = { ...project.settings };
            const newSettings = { ...project.settings, ...settings };
            setProject({ ...project, settings: newSettings });
            try {
                await getGitpodService().server.updateProjectPartial({ id: project.id, settings: newSettings });
                toast(`Project ${projectName} updated.`);
            } catch (error) {
                setProject({ ...project, settings: oldSettings });
                toast(error?.message || "Oh no, there was a problem with updating project settings.");
            }
        },
        [project, setProject, toast, projectName],
    );

    const setPrebuildBranchStrategy = useCallback(
        async (value: PrebuildSettings.BranchStrategy) => {
            if (!project) {
                return;
            }
            const oldValue = Project.getPrebuildBranchStrategy(project);
            if (oldValue === value) {
                return;
            }
            const update: ProjectSettings = { ...project.settings };
            update.prebuilds = { ...update.prebuilds };
            update.prebuilds.branchStrategy = value;

            if (value === "matched-branches") {
                update.prebuilds.branchMatchingPattern = update.prebuilds.branchMatchingPattern || "**";
            }
            await updateProjectSettings(update);
        },
        [updateProjectSettings, project],
    );

    const debouncedUpdatePrebuildBranchPattern = useMemo(() => {
        return debounce(async (prebuildBranchPattern: string) => {
            if (!project) {
                return;
            }
            const update: ProjectSettings = { ...project.settings };
            update.prebuilds = { ...update.prebuilds };
            update.prebuilds.branchMatchingPattern = prebuildBranchPattern;

            await updateProjectSettings(update);
        }, 1500);
    }, [updateProjectSettings, project]);

    const updatePrebuildBranchPattern = useCallback(
        async (value: string) => {
            setPrebuildBranchPattern(value);

            debouncedUpdatePrebuildBranchPattern(value);
        },
        [debouncedUpdatePrebuildBranchPattern],
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
                return;
            }
            const update: ProjectSettings = { ...project.settings };
            update.prebuilds = { ...update.prebuilds };
            update.prebuilds.workspaceClass = value;

            await updateProjectSettings(update);
        },
        [project, updateProjectSettings],
    );

    const setPrebuildInterval = useCallback(
        async (value: string) => {
            if (!project) {
                return;
            }
            const newInterval = Math.abs(Math.min(Number.parseInt(value), 100)) || 0;
            const update: ProjectSettings = { ...project.settings };
            update.prebuilds = { ...update.prebuilds };
            update.prebuilds.prebuildInterval = newInterval;

            await updateProjectSettings(update);
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

    const prebuildInterval = project.settings?.prebuilds?.prebuildInterval || 10;

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
                            containerClassName="max-w-md ml-6 text-sm"
                            onChange={(val) => setPrebuildBranchStrategy(val as PrebuildSettings.BranchStrategy)}
                        >
                            <option value="defaultBranch">Default branch (e.g. main)</option>
                            <option value="allBranches">All branches</option>
                            <option value="selectedBranches">Matched by pattern</option>
                        </SelectInputField>
                        {prebuildBranchStrategy === "matched-branches" && (
                            <div className="flex flex-col ml-6 mt-4">
                                <label
                                    htmlFor="selectedBranches"
                                    className={classNames(
                                        "text-sm font-semibold cursor-pointer tracking-wide",
                                        !enablePrebuilds
                                            ? "text-gray-400 dark:text-gray-400"
                                            : "text-gray-600 dark:text-gray-100",
                                    )}
                                >
                                    Branch name pattern
                                </label>
                                <input
                                    type="text"
                                    id="selectedBranches"
                                    className="mt-2"
                                    disabled={prebuildBranchStrategy !== "matched-branches"}
                                    value={prebuildBranchPattern}
                                    onChange={({ target }) => updatePrebuildBranchPattern(target.value)}
                                />
                                <div className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                                    Glob patterns separated by commas are supported.
                                </div>
                            </div>
                        )}
                        <InputField
                            className="max-w-md ml-6 text-sm"
                            label="Workspace machine type"
                            disabled={!enablePrebuilds}
                        >
                            <SelectWorkspaceClassComponent
                                disabled={!enablePrebuilds}
                                selectedWorkspaceClass={project.settings?.workspaceClasses?.prebuild}
                                onSelectionChange={setWorkspaceClassForPrebuild}
                            />
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
                                    htmlFor="prebuildInterval"
                                    className={classNames(
                                        "text-sm font-semibold cursor-pointer tracking-wide",
                                        !enablePrebuilds
                                            ? "text-gray-400 dark:text-gray-400"
                                            : "text-gray-600 dark:text-gray-100",
                                    )}
                                >
                                    Prebuild interval
                                </label>
                                <input
                                    type="number"
                                    id="prebuildInterval"
                                    min="0"
                                    max="100"
                                    step="5"
                                    className="mt-2"
                                    disabled={!enablePrebuilds}
                                    value={prebuildInterval}
                                    onChange={({ target }) => setPrebuildInterval(target.value)}
                                />
                                <div className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                                    The number of commits to be skipped between prebuild runs.
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
