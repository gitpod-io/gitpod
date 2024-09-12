/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import { Configuration, PrebuildTriggerStrategy } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { ConfigurationSettingsField } from "./ConfigurationSettingsField";
import { Heading3, Subheading } from "@podkit/typography/Headings";
import { SwitchInputField } from "@podkit/switch/Switch";
import { PrebuildSettingsForm } from "./prebuilds/PrebuildSettingsForm";
import { useConfigurationMutation } from "../../data/configurations/configuration-queries";
import { LoadingState } from "@podkit/loading/LoadingState";
import { EnablePrebuildsError } from "./prebuilds/EnablePrebuildsError";
import { TextMuted } from "@podkit/typography/TextMuted";
import { Link } from "react-router-dom";
import { useWebhookActivityStatusQuery } from "../../data/prebuilds/prebuild-queries";
import Alert from "../../components/Alert";
import { useToast } from "../../components/toasts/Toasts";

type Props = {
    configuration: Configuration;
};
export const ConfigurationDetailPrebuilds: FC<Props> = ({ configuration }) => {
    const updateConfiguration = useConfigurationMutation();

    const [enabled, setEnabled] = useState(!!configuration.prebuildSettings?.enabled);

    const updateEnabled = useCallback(
        (newEnabled: boolean) => {
            setEnabled(newEnabled);
            updateConfiguration.mutate(
                {
                    configurationId: configuration.id,
                    prebuildSettings: {
                        ...configuration.prebuildSettings,
                        enabled: newEnabled,
                    },
                },
                {
                    onSettled(configuration) {
                        // True up local state with server state
                        if (configuration) {
                            setEnabled(configuration.prebuildSettings?.enabled ?? false);
                        } else {
                            setEnabled(false);
                        }
                    },
                },
            );
        },
        [configuration.id, configuration.prebuildSettings, updateConfiguration],
    );

    const handleReconnection = useCallback(() => {
        updateEnabled(true);
    }, [updateEnabled]);

    return (
        <>
            <ConfigurationSettingsField>
                <Heading3>Prebuilds</Heading3>
                <Subheading className="max-w-lg">Prebuilds reduce wait time for new workspaces.</Subheading>
                {configuration.prebuildSettings?.enabled &&
                    configuration.prebuildSettings.triggerStrategy !== PrebuildTriggerStrategy.ACTIVITY_BASED && (
                        <WebhookTriggerMessage configurationId={configuration.id} />
                    )}

                <SwitchInputField
                    className="mt-6"
                    id="prebuilds-enabled"
                    checked={enabled}
                    onCheckedChange={updateEnabled}
                    label={configuration.prebuildSettings?.enabled ? "Prebuilds are enabled" : "Prebuilds are disabled"}
                    description={
                        <TextMuted>
                            <Link to={`/prebuilds?configurationId=${configuration.id}`} className="gp-link">
                                View prebuild history
                            </Link>
                        </TextMuted>
                    }
                />
            </ConfigurationSettingsField>

            {updateConfiguration.isLoading && enabled && (
                <ConfigurationSettingsField>
                    <div className="flex flex-row gap-2 items-center text-pk-content-tertiary">
                        <LoadingState delay={false} />
                        <span>Enabling prebuilds...</span>
                    </div>
                </ConfigurationSettingsField>
            )}

            {updateConfiguration.isError && (
                <EnablePrebuildsError error={updateConfiguration.error} onReconnect={handleReconnection} />
            )}

            {enabled && !updateConfiguration.isLoading && !updateConfiguration.isError && (
                <PrebuildSettingsForm configuration={configuration} />
            )}
        </>
    );
};

export const WebhookTriggerMessage = ({ configurationId }: { configurationId: string }) => {
    const integrationStatus = useWebhookActivityStatusQuery(configurationId);
    const { toast } = useToast();

    if (integrationStatus.isError) {
        toast("Failed to load webhook activity status");
        return null;
    }
    if (!integrationStatus?.data?.isWebhookActive) {
        return null;
    }

    return (
        <Alert type="warning">
            <div className="flex flex-row gap-2 items-center">
                <span>
                    We have gotten webhook activity from your repository recently, indicating you have webhooks
                    installed on your repo. To optimize prebuilds usage, you might want to consider enabling Activity
                    based prebuilds by removing our webhook. If you remove them, it might take a new commit for this
                    message to disappear, although activity based prebuilds will start working right away.
                </span>
                <div>
                    <a
                        href="https://www.gitpod.io/changelog/activity-based-prebuilds"
                        className="gp-link"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Learn more about Activity based prebuilds
                    </a>
                </div>
            </div>
        </Alert>
    );
};
