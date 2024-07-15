/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    BranchMatchingStrategy,
    Configuration,
    PrebuildTriggerStrategy,
} from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { FC, FormEvent, useCallback, useMemo, useState } from "react";
import { ConfigurationSettingsField } from "../ConfigurationSettingsField";
import { Heading3, Subheading } from "@podkit/typography/Headings";
import { InputField } from "../../../components/forms/InputField";
import { PartialConfiguration, useConfigurationMutation } from "../../../data/configurations/configuration-queries";
import { useToast } from "../../../components/toasts/Toasts";
import { TextInputField } from "../../../components/forms/TextInputField";
import { WorkspaceClassOptions } from "../shared/WorkspaceClassOptions";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { InputFieldHint } from "../../../components/forms/InputFieldHint";
import { DEFAULT_WS_CLASS } from "../../../data/workspaces/workspace-classes-query";
import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from "@podkit/select/Select";
import Alert from "../../../components/Alert";
import { useUserLoader } from "../../../hooks/use-user-loader";
import { useUpdateCurrentUserMutation } from "../../../data/current-user/update-mutation";
import { trackEvent } from "../../../Analytics";
import dayjs from "dayjs";

const DEFAULT_PREBUILD_COMMIT_INTERVAL = 20;

type Props = {
    configuration: Configuration;
};

const COACHMARK_KEY = "new_prebuilds_trigger_notification";

export const PrebuildSettingsForm: FC<Props> = ({ configuration }) => {
    const { toast } = useToast();

    const { user } = useUserLoader();
    const { mutate: updateUser } = useUpdateCurrentUserMutation();

    const updateConfiguration = useConfigurationMutation();

    const [interval, setInterval] = useState<string>(
        `${configuration.prebuildSettings?.prebuildInterval ?? DEFAULT_PREBUILD_COMMIT_INTERVAL}`,
    );
    const [branchStrategy, setBranchStrategy] = useState<BranchMatchingStrategy>(
        configuration.prebuildSettings?.branchStrategy ?? BranchMatchingStrategy.DEFAULT_BRANCH,
    );
    const [branchMatchingPattern, setBranchMatchingPattern] = useState<string>(
        configuration.prebuildSettings?.branchMatchingPattern || "**",
    );
    const [workspaceClass, setWorkspaceClass] = useState<string>(
        configuration.prebuildSettings?.workspaceClass || DEFAULT_WS_CLASS,
    );

    const [isTriggerNotificationOpen, setIsTriggerNotificationOpen] = useState(true);

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

    const dismissNotification = useCallback(() => {
        updateUser(
            {
                additionalData: { profile: { coachmarksDismissals: { [COACHMARK_KEY]: dayjs().toISOString() } } },
            },
            {
                onSettled: (_, error) => {
                    trackEvent("coachmark_dismissed", {
                        name: COACHMARK_KEY,
                        success: !(error instanceof Error),
                    });
                    setIsTriggerNotificationOpen(false);
                },
            },
        );
    }, [updateUser]);

    const showTriggerNotification = useMemo<boolean>(() => {
        if (!isTriggerNotificationOpen || !user) {
            return false;
        }

        if (configuration.prebuildSettings?.triggerStrategy === PrebuildTriggerStrategy.ACTIVITY_BASED) {
            return false;
        }

        // For repositories created after activity-based prebuilds were introduced, don't show it
        if (configuration.creationTime && configuration.creationTime.toDate() > new Date("7/15/2024")) {
            return false;
        }

        return !user.profile?.coachmarksDismissals[COACHMARK_KEY];
    }, [configuration.creationTime, configuration.prebuildSettings?.triggerStrategy, isTriggerNotificationOpen, user]);

    return (
        <ConfigurationSettingsField>
            {showTriggerNotification && (
                <Alert
                    type={"info"}
                    closable={true}
                    onClose={() => dismissNotification()}
                    showIcon={true}
                    className="flex rounded p-2 mb-2 w-full"
                >
                    The way prebuilds are triggered is changing.{" "}
                    <a
                        className="gp-link"
                        target="_blank"
                        href="https://www.gitpod.io/changelog/activity-based-prebuilds"
                        rel="noreferrer"
                    >
                        Learn more
                    </a>
                </Alert>
            )}
            <form onSubmit={handleSubmit}>
                <Heading3>Prebuild settings</Heading3>
                <Subheading className="max-w-lg">These settings will be applied on every Prebuild.</Subheading>

                <InputField
                    label="Commit interval"
                    hint="The number of commits to be skipped between prebuild runs."
                    id="prebuild-interval"
                >
                    <input
                        className="w-20"
                        type="number"
                        id="prebuild-interval"
                        min="0"
                        max="100"
                        step="5"
                        value={interval}
                        onChange={({ target }) => setInterval(target.value)}
                    />
                </InputField>

                <InputField label="Branch Filter" hint="Run prebuilds on the selected branches only.">
                    <Select value={`${branchStrategy}`} onValueChange={handleBranchStrategyChange}>
                        <SelectTrigger className="w-60">
                            <SelectValue placeholder="Select a branch filter" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={`${BranchMatchingStrategy.ALL_BRANCHES}`}>All branches</SelectItem>
                            <SelectItem value={`${BranchMatchingStrategy.DEFAULT_BRANCH}`}>Default branch</SelectItem>
                            <SelectItem value={`${BranchMatchingStrategy.MATCHED_BRANCHES}`}>
                                Match branches by pattern
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </InputField>

                {branchStrategy === BranchMatchingStrategy.MATCHED_BRANCHES && (
                    <TextInputField
                        label="Branch name pattern"
                        hint="Glob patterns separated by commas are supported."
                        value={branchMatchingPattern}
                        onChange={setBranchMatchingPattern}
                    />
                )}

                <Heading3 className="mt-8">Machine type</Heading3>
                <Subheading>Choose the workspace machine type for your prebuilds.</Subheading>

                <WorkspaceClassOptions value={workspaceClass} onChange={setWorkspaceClass} />
                <InputFieldHint>Use a smaller machine type for cost optimization.</InputFieldHint>

                <LoadingButton className="mt-8" type="submit" loading={updateConfiguration.isLoading}>
                    Save
                </LoadingButton>
            </form>
        </ConfigurationSettingsField>
    );
};
