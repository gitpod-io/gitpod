/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { ConfigurationSettingsField } from "./ConfigurationSettingsField";
import { Heading3, Subheading } from "@podkit/typography/Headings";
import { Switch } from "@podkit/switch/Switch";
import { TextMuted } from "@podkit/typography/TextMuted";
import { PrebuildSettingsForm } from "./prebuilds/PrebuildSettingsForm";
import { useConfigurationMutation } from "../../data/configurations/configuration-queries";
import { LoadingState } from "@podkit/loading/LoadingState";
import { EnablePrebuildsError } from "./prebuilds/EnablePrebuildsError";

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

                <div className="flex gap-4 mt-6">
                    {/* TODO: wrap this in a SwitchInputField that handles the switch, label and description and htmlFor/id automatically */}
                    <div className="flex flex-col gap-2 items-center">
                        <Switch
                            checked={enabled}
                            onCheckedChange={updateEnabled}
                            id="prebuilds-enabled"
                            disabled={updateConfiguration.isLoading}
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="font-semibold" htmlFor="prebuilds-enabled">
                            {enabled && !updateConfiguration.isLoading
                                ? "Prebuilds are enabled"
                                : "Prebuilds are disabled"}
                        </label>
                        <TextMuted>
                            Enabling requires permissions to configure repository webhooks.{" "}
                            <a
                                href="https://www.gitpod.io/docs/configure/projects/prebuilds"
                                className="gp-link"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Learn more
                            </a>
                            .
                        </TextMuted>
                    </div>
                </div>
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
