/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { useState } from "react";
import { Heading3, Subheading } from "@podkit/typography/Headings";
import { ConfigurationSettingsField } from "../ConfigurationSettingsField";
import { useConfigurationMutation } from "../../../data/configurations/configuration-queries";
import { useAllowedWorkspaceClassesMemo } from "../../../data/workspaces/workspace-classes-query";
import { Button } from "@podkit/buttons/Button";
import { AlertTriangleIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import {
    WorkspaceClassesModifyModal,
    WorkspaceClassesModifyModalProps,
    WorkspaceClassesOptions,
} from "../../../components/WorkspaceClassesOptions";

export const ConfigurationWorkspaceClassesOptions = ({ configuration }: { configuration: Configuration }) => {
    const [showModal, setShowModal] = useState(false);
    const configurationMutation = useConfigurationMutation();

    const { data: allowedClassesInConfiguration, isLoading: isLoadingInConfig } = useAllowedWorkspaceClassesMemo(
        configuration.id,
        {
            filterOutDisabled: true,
        },
    );
    const { data: allowedClassesInOrganization, isLoading: isLoadingInOrg } = useAllowedWorkspaceClassesMemo(
        undefined,
        {
            filterOutDisabled: false,
            ignoreScope: ["configuration"],
        },
    );

    const updateMutation: WorkspaceClassesModifyModalProps["updateMutation"] = useMutation({
        mutationFn: async ({ restrictedWorkspaceClasses, defaultClass }) => {
            await configurationMutation.mutateAsync({
                configurationId: configuration.id,
                workspaceSettings: {
                    workspaceClass: defaultClass,
                    restrictedWorkspaceClasses,
                    updateRestrictedWorkspaceClasses: true,
                },
            });
        },
    });

    return (
        <ConfigurationSettingsField>
            <Heading3>Available workspace classes</Heading3>
            <Subheading>Limit the available workspace classes for this repository.</Subheading>

            <div className="mt-4">
                <WorkspaceClassesOptions
                    isLoading={isLoadingInConfig}
                    emptyState={
                        <div className="font-semibold text-pk-content-primary flex gap-2 items-center">
                            <AlertTriangleIcon size={20} className="text-red-500" />
                            <span>This repository doesn't have any available workspace classes.</span>
                        </div>
                    }
                    classes={allowedClassesInConfiguration}
                    defaultClass={configuration.workspaceSettings?.workspaceClass}
                />
            </div>

            {showModal && (
                <WorkspaceClassesModifyModal
                    isLoading={isLoadingInOrg}
                    showSetDefaultButton
                    showSwitchTitle={true}
                    defaultClass={configuration.workspaceSettings?.workspaceClass}
                    restrictedWorkspaceClasses={configuration.workspaceSettings?.restrictedWorkspaceClasses ?? []}
                    allowedClasses={allowedClassesInOrganization}
                    updateMutation={updateMutation}
                    onClose={() => setShowModal(false)}
                />
            )}

            <Button className="mt-8" onClick={() => setShowModal(true)}>
                Manage Classes
            </Button>
        </ConfigurationSettingsField>
    );
};
