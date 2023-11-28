/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { ConfigurationSettingsField } from "./ConfigurationSettingsField";
import { Heading3, Subheading } from "@podkit/typography/Headings";

type Props = {
    configuration: Configuration;
};
export const ConfigurationDetailPrebuilds: FC<Props> = ({ configuration }) => {
    return (
        <>
            <ConfigurationSettingsField>
                <Heading3>Prebuilds</Heading3>
                <Subheading>
                    Prebuilds reduce wait time for new workspaces. Enabling requires permissions to configure repository
                    webhooks.{" "}
                    <a href="/docs/configure/projects/prebuilds" className="gp-link">
                        Learn more
                    </a>
                    .
                </Subheading>
            </ConfigurationSettingsField>
        </>
    );
};
