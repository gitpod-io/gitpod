/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import React, { useCallback, useState } from "react";
import { Heading3, Subheading } from "@podkit/typography/Headings";
import { ConfigurationSettingsField } from "../ConfigurationSettingsField";
import { useToast } from "../../../components/toasts/Toasts";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { useConfigurationMutation } from "../../../data/configurations/configuration-queries";
import { WorkspaceClassOptions } from "../shared/WorkspaceClassOptions";

interface Props {
    configuration: Configuration;
}

export const ConfigurationWorkspaceSizeOptions = ({ configuration }: Props) => {
    const [selectedValue, setSelectedValue] = useState(
        configuration.workspaceSettings?.workspaceClass || "g1-standard",
    );
    const classChanged = selectedValue !== configuration.workspaceSettings?.workspaceClass;

    const updateConfiguration = useConfigurationMutation();
    const { toast } = useToast();

    const setWorkspaceClass = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();

            updateConfiguration.mutate(
                {
                    configurationId: configuration.id,
                    workspaceSettings: {
                        workspaceClass: selectedValue,
                    },
                },
                {
                    onSuccess: () => {
                        // todo: use optimistic updates when we introduce configuration update hooks
                        toast({ message: "Workspace size updated" });
                    },
                    onError: (e) => {
                        toast({ message: `Failed updating workspace size: ${e.message}` });
                    },
                },
            );
        },
        [configuration.id, selectedValue, toast, updateConfiguration],
    );

    return (
        <ConfigurationSettingsField>
            <form onSubmit={setWorkspaceClass}>
                <Heading3>Workspace Size Options</Heading3>
                <Subheading>Choose the size of your workspace based on the resources you need.</Subheading>

                <WorkspaceClassOptions value={selectedValue} onChange={setSelectedValue} />

                <LoadingButton
                    className="mt-8"
                    type="submit"
                    disabled={!classChanged}
                    loading={updateConfiguration.isLoading}
                >
                    Save
                </LoadingButton>
            </form>
        </ConfigurationSettingsField>
    );
};
