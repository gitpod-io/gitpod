/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { LinkButton } from "@podkit/buttons/LinkButton";
import PillLabel from "../../components/PillLabel";
import { Heading3, Subheading } from "../../components/typography/headings";
import { ConfigurationSettingsField } from "../../repositories/detail/ConfigurationSettingsField";

export const WorkspaceClassesEnterpriseCallout = () => {
    return (
        <ConfigurationSettingsField className="bg-pk-surface-secondary">
            <Heading3 className="flex items-center gap-4">
                Additional workspace classes
                <PillLabel type="warn">Enterprise</PillLabel>
            </Heading3>
            <Subheading>
                Access to more powerful workspace classes with up to 30 cores 54GB of RAM and 100GB of storage
            </Subheading>

            <div className="mt-6 flex flex-row space-x-2">
                <LinkButton
                    variant="secondary"
                    className="border border-pk-content-tertiary text-pk-content-primary bg-pk-surface-primary"
                    href="https://www.gitpod.io/docs/configure/workspaces/workspace-classes#enterprise"
                    isExternalUrl={true}
                >
                    Documentation
                </LinkButton>
                <LinkButton
                    variant="secondary"
                    className="border border-pk-content-tertiary text-pk-content-primary bg-pk-surface-primary"
                    href="https://www.gitpod.io/docs/enterprise"
                    isExternalUrl={true}
                >
                    Learn more about Enterprise
                </LinkButton>
            </div>
        </ConfigurationSettingsField>
    );
};
