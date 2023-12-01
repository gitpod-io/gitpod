/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useState } from "react";
import { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { ConfigurationSettingsField } from "./ConfigurationSettingsField";
import { Heading3, Subheading } from "@podkit/typography/Headings";
import { Switch } from "@podkit/switch/Switch";
import { TextMuted } from "@podkit/typography/TextMuted";

type Props = {
    configuration: Configuration;
};
export const ConfigurationDetailPrebuilds: FC<Props> = ({ configuration }) => {
    // TODO: hook this up to just use configuration as state and wire up optimistic update for mutation
    const [enabled, setEnabled] = useState(!!configuration.prebuildSettings?.enabled);

    return (
        <>
            <ConfigurationSettingsField>
                <Heading3>Prebuilds</Heading3>
                <Subheading className="max-w-lg">
                    Prebuilds reduce wait time for new workspaces. Enabling requires permissions to configure repository
                    webhooks.{" "}
                    <a
                        href="/docs/configure/projects/prebuilds"
                        className="gp-link"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Learn more
                    </a>
                    .
                </Subheading>

                <div className="flex gap-4 mt-6">
                    {/* TODO: wrap this in a SwitchInputField that handles the switch, label and description and htmlFor/id automatically */}
                    <Switch checked={enabled} onCheckedChange={setEnabled} id="prebuilds-enabled" />
                    <div className="flex flex-col">
                        <label className="font-semibold" htmlFor="prebuilds-enabled">
                            Prebuilds are enabled
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
        </>
    );
};
