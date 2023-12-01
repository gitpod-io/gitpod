/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BranchMatchingStrategy, Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { FC, FormEvent, useCallback, useState } from "react";
import { ConfigurationSettingsField } from "../ConfigurationSettingsField";
import { Heading3, Subheading } from "@podkit/typography/Headings";
import { InputField } from "../../../components/forms/InputField";
import { PartialConfiguration, useConfigurationMutation } from "../../../data/configurations/configuration-queries";
import { useToast } from "../../../components/toasts/Toasts";
import { SelectInputField } from "../../../components/forms/SelectInputField";
import { TextInputField } from "../../../components/forms/TextInputField";
import { WorkspaceClassOptions } from "../shared/WorkspaceClassOptions";
import { LoadingButton } from "@podkit/buttons/LoadingButton";

type Props = {
    configuration: Configuration;
};

export const PrebuildSettingsForm: FC<Props> = ({ configuration }) => {
    const { toast } = useToast();
    const updateConfiguration = useConfigurationMutation();

    const [interval, setInterval] = useState<string>(`${configuration.prebuildSettings?.prebuildInterval ?? 20}`);
    const [branchStrategy, setBranchStrategy] = useState<BranchMatchingStrategy>(
        configuration.prebuildSettings?.branchStrategy ?? BranchMatchingStrategy.DEFAULT_BRANCH,
    );
    const [branchMatchingPattern, setBranchMatchingPattern] = useState<string>(
        configuration.prebuildSettings?.branchMatchingPattern || "**",
    );
    const [workspaceClass, setWorkspaceClass] = useState<string>(
        configuration.prebuildSettings?.workspaceClass || "g1-standard",
    );

    const handleSubmit = useCallback(
        (e: FormEvent) => {
            e.preventDefault();

            const newInterval = Math.abs(Math.min(Number.parseInt(interval), 100)) || 0;

            const updatedConfig: PartialConfiguration = {
                configurationId: configuration.id,
                prebuildSettings: {
                    ...configuration.prebuildSettings,
                    prebuildInterval: newInterval,
                    branchStrategy,
                    branchMatchingPattern,
                    workspaceClass,
                },
            };

            updateConfiguration.mutate(updatedConfig, {
                onSuccess: () => {
                    toast("Your prebuild settings were updated.");
                },
            });
        },
        [
            branchMatchingPattern,
            branchStrategy,
            configuration.id,
            configuration.prebuildSettings,
            interval,
            toast,
            updateConfiguration,
            workspaceClass,
        ],
    );

    // TODO: Figure out if there's a better way to deal with grpc enums in the UI
    const handleBranchStrategyChange = useCallback((val) => {
        // This is pretty hacky, trying to coerce value into a number and then cast it to the enum type
        // Would be better if we treated these as strings instead of special enums
        setBranchStrategy(parseInt(val, 10) as BranchMatchingStrategy);
    }, []);

    return (
        <ConfigurationSettingsField>
            <form onSubmit={handleSubmit}>
                <Heading3>Prebuild Settings</Heading3>
                <Subheading className="max-w-lg">These settings will be applied on every Prebuild.</Subheading>

                <InputField
                    label="Commit interval"
                    hint="The number of commits to be skipped between prebuild runs."
                    id="prebuild-interval"
                >
                    <input
                        type="number"
                        id="prebuild-interval"
                        min="0"
                        max="100"
                        step="5"
                        value={interval}
                        onChange={({ target }) => setInterval(target.value)}
                    />
                </InputField>

                <SelectInputField
                    label="Branch Filter"
                    hint="Run prebuilds on the selected branches only."
                    value={branchStrategy}
                    onChange={handleBranchStrategyChange}
                >
                    <option value={BranchMatchingStrategy.ALL_BRANCHES}>All branches</option>
                    <option value={BranchMatchingStrategy.DEFAULT_BRANCH}>Default branch</option>
                    <option value={BranchMatchingStrategy.MATCHED_BRANCHES}>Match branches by pattern</option>
                </SelectInputField>

                {branchStrategy === BranchMatchingStrategy.MATCHED_BRANCHES && (
                    <TextInputField
                        label="Branch name pattern"
                        hint="Glob patterns separated by commas are supported."
                        value={branchMatchingPattern}
                        onChange={setBranchMatchingPattern}
                    />
                )}

                <WorkspaceClassOptions value={workspaceClass} onChange={setWorkspaceClass} />

                <LoadingButton className="mt-8" type="submit" loading={updateConfiguration.isLoading}>
                    Save
                </LoadingButton>
            </form>
        </ConfigurationSettingsField>
    );
};
