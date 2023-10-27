/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the repository root for license information.
 */

import { PrebuildSettings, Project, ProjectSettings } from "@gitpod/gitpod-protocol";
import { cn } from "@podkit/lib/cn";
import debounce from "lodash.debounce";
import { Fragment, useCallback, useMemo, useState } from "react";
import SelectWorkspaceClassComponent from "../../components/SelectWorkspaceClassComponent";
import { CheckboxInputField } from "../../components/forms/CheckboxInputField";
import { InputField } from "../../components/forms/InputField";
import { SelectInputField } from "../../components/forms/SelectInputField";
import { useToast } from "../../components/toasts/Toasts";
import { useUpdateProject } from "../../data/projects/project-queries";
import { Heading2 } from "@podkit/typography/headings";

interface RepositoryPrebuildsSettingsProps {
    repository: Project;
}

export default function ConfigurationPrebuildsSettings({ repository }: RepositoryPrebuildsSettingsProps) {
    const updateRepository = useUpdateProject();

    const { toast } = useToast();
    const [prebuildBranchPattern, setPrebuildBranchPattern] = useState(
        repository?.settings?.prebuilds?.branchMatchingPattern ?? "",
    );

    const updateRepositorySettings = useCallback(
        async (settings: ProjectSettings) => {
            if (!repository) return;

            const newSettings = { ...repository.settings, ...settings };
            await updateRepository.mutateAsync(
                { id: repository.id, settings: newSettings },
                {
                    onSuccess: () => {
                        toast(`Project ${repository.name} updated.`);
                    },
                    onError: (error) => {
                        toast(error?.message || "Oh no, there was a problem with updating repository settings.");
                    },
                },
            );
        },
        [repository, toast, updateRepository],
    );

    const setPrebuildsEnabled = useCallback(
        async (enabled: boolean) => {
            if (!repository) {
                return;
            }

            await updateRepositorySettings({
                prebuilds: {
                    ...repository.settings?.prebuilds,
                    enable: enabled,
                },
            });
        },
        [repository, updateRepositorySettings],
    );

    const setPrebuildBranchStrategy = useCallback(
        async (value: PrebuildSettings.BranchStrategy) => {
            const oldValue = Project.getPrebuildSettings(repository).branchStrategy;
            if (oldValue === value) {
                return;
            }
            const update: ProjectSettings = { ...repository.settings };
            update.prebuilds = { ...update.prebuilds };
            update.prebuilds.branchStrategy = value;

            if (value === "matched-branches") {
                update.prebuilds.branchMatchingPattern = update.prebuilds.branchMatchingPattern || "**";
            }
            await updateRepositorySettings(update);
        },
        [updateRepositorySettings, repository],
    );

    const debouncedUpdatePrebuildBranchPattern = useMemo(() => {
        return debounce(async (prebuildBranchPattern: string) => {
            const update: ProjectSettings = { ...repository.settings };
            update.prebuilds = { ...update.prebuilds };
            update.prebuilds.branchMatchingPattern = prebuildBranchPattern;

            await updateRepositorySettings(update);
        }, 1500);
    }, [updateRepositorySettings, repository]);

    const updatePrebuildBranchPattern = useCallback(
        async (value: string) => {
            if (!value) {
                return;
            }
            setPrebuildBranchPattern(value);

            debouncedUpdatePrebuildBranchPattern(value);
        },
        [debouncedUpdatePrebuildBranchPattern],
    );

    const setWorkspaceClassForPrebuild = useCallback(
        async (value: string) => {
            const update: ProjectSettings = { ...repository.settings };
            update.prebuilds = { ...update.prebuilds };
            update.prebuilds.workspaceClass = value;

            await updateRepositorySettings(update);
        },
        [repository, updateRepositorySettings],
    );

    const setPrebuildInterval = useCallback(
        async (value: string) => {
            const newInterval = Math.abs(Math.min(Number.parseInt(value), 100)) || 0;
            const update: ProjectSettings = { ...repository.settings };
            update.prebuilds = { ...update.prebuilds };
            update.prebuilds.prebuildInterval = newInterval;

            updateRepositorySettings(update);
        },
        [repository, updateRepositorySettings],
    );

    const prebuildSettings = Project.getPrebuildSettings(repository);

    return (
        <section>
            <Heading2 className="mt-12">Prebuilds</Heading2>
            <CheckboxInputField
                label="Enable prebuilds"
                hint={
                    <span>
                        <Fragment>
                            Prebuilds reduce wait time for new workspaces.
                            {!prebuildSettings.enable
                                ? " Enabling requires permissions to configure repository webhooks."
                                : ""}
                        </Fragment>{" "}
                        <a
                            className="gp-link"
                            target="_blank"
                            rel="noreferrer"
                            href="https://www.gitpod.io/docs/configure/repository/prebuilds"
                        >
                            Learn more
                        </a>
                    </span>
                }
                checked={!!prebuildSettings.enable}
                onChange={setPrebuildsEnabled}
            />
            {prebuildSettings.enable && (
                <>
                    <div className="flex mt-4 max-w-2xl">
                        <div className="flex flex-col ml-6">
                            <label
                                htmlFor="prebuildInterval"
                                className={cn(
                                    "text-sm font-semibold cursor-pointer tracking-wide",
                                    !prebuildSettings.enable
                                        ? "text-gray-400 dark:text-gray-400"
                                        : "text-gray-600 dark:text-gray-100",
                                )}
                            >
                                Commit Interval
                            </label>
                            <input
                                type="number"
                                id="prebuildInterval"
                                min="0"
                                max="100"
                                step="5"
                                className="mt-2"
                                disabled={!prebuildSettings.enable}
                                value={prebuildSettings.prebuildInterval}
                                onChange={({ target }) => setPrebuildInterval(target.value)}
                            />
                            <div className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                                The number of commits to be skipped between prebuild runs.
                            </div>
                        </div>
                    </div>
                    <div>
                        <SelectInputField
                            disabled={!prebuildSettings.enable}
                            label="Branch Filter"
                            value={prebuildSettings.branchStrategy ?? ""}
                            containerClassName="max-w-md ml-6 text-sm"
                            onChange={(val) => setPrebuildBranchStrategy(val as PrebuildSettings.BranchStrategy)}
                        >
                            <option value="all-branches">All branches</option>
                            <option value="default-branch">Default branch</option>
                            <option value="matched-branches">Match branches by pattern</option>
                        </SelectInputField>
                        <div className="ml-6 text-gray-500 dark:text-gray-400 text-sm mt-2">
                            Run prebuilds on the selected branches only.
                        </div>
                    </div>
                    {prebuildSettings.branchStrategy === "matched-branches" && (
                        <div className="flex flex-col ml-6 mt-4">
                            <label
                                htmlFor="selectedBranches"
                                className={cn(
                                    "text-sm font-semibold cursor-pointer tracking-wide",
                                    !prebuildSettings.enable
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
                                disabled={prebuildSettings.branchStrategy !== "matched-branches"}
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
                        label="Machine type"
                        disabled={!prebuildSettings.enable}
                    >
                        <SelectWorkspaceClassComponent
                            disabled={!prebuildSettings.enable}
                            selectedWorkspaceClass={prebuildSettings.workspaceClass}
                            onSelectionChange={setWorkspaceClassForPrebuild}
                        />
                        <div className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                            Use a smaller machine type for cost optimization.
                        </div>
                    </InputField>
                </>
            )}
        </section>
    );
}
