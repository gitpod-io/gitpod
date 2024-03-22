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
import { Button } from "@podkit/buttons/Button";
import { useMutation } from "@tanstack/react-query";
import { useAllowedWorkspaceEditorsMemo } from "../../../data/ide-options/ide-options-query";
import { IdeOptions, IdeOptionsModifyModal, IdeOptionsModifyModalProps } from "../../../components/IdeOptions";
import { useOrgSettingsQuery } from "../../../data/organizations/org-settings-query";
import { AlertTriangleIcon } from "lucide-react";

export const ConfigurationWorkspaceEditorsOptions = ({ configuration }: { configuration: Configuration }) => {
    const configurationMutation = useConfigurationMutation();
    const { data: orgSettings } = useOrgSettingsQuery();
    const [showModal, setShowModal] = useState(false);
    const { data: orgOptions, isLoading: orgOptionsIsLoading } = useAllowedWorkspaceEditorsMemo(configuration.id, {
        filterOutDisabled: false,
        ignoreScope: ["configuration"],
    });
    const { data: repoOptions, isLoading: repoOptionsIsLoading } = useAllowedWorkspaceEditorsMemo(configuration.id, {
        filterOutDisabled: true,
    });

    const updateMutation: IdeOptionsModifyModalProps["updateMutation"] = useMutation({
        mutationFn: async ({ restrictedEditors }) => {
            const updatedRestrictedEditors = [...restrictedEditors.keys()];
            await configurationMutation.mutateAsync({
                configurationId: configuration.id,
                workspaceSettings: {
                    restrictedEditorNames: updatedRestrictedEditors,
                    updateRestrictedEditorNames: true,
                },
            });
        },
    });

    const pinnedEditorVersions = new Map<string, string>(Object.entries(orgSettings?.pinnedEditorVersions || {}));
    const restrictedEditors = new Set<string>(configuration.workspaceSettings?.restrictedEditorNames || []);

    return (
        <ConfigurationSettingsField>
            <Heading3>Available editors</Heading3>
            <Subheading>Limit the available editors for this repository.</Subheading>

            <div className="mt-4">
                <IdeOptions
                    isLoading={repoOptionsIsLoading}
                    emptyState={
                        <div className="font-semibold text-pk-content-primary flex gap-2 items-center">
                            <AlertTriangleIcon size={20} className="text-red-500" />
                            <span>This repository doesn't have any available editor.</span>
                        </div>
                    }
                    ideOptions={repoOptions}
                    pinnedEditorVersions={pinnedEditorVersions}
                />
            </div>

            <Button className="mt-6" onClick={() => setShowModal(true)}>
                Manage Editors
            </Button>

            {showModal && (
                <IdeOptionsModifyModal
                    hidePinEditorInputs
                    isLoading={orgOptionsIsLoading}
                    ideOptions={orgOptions}
                    restrictedEditors={restrictedEditors}
                    pinnedEditorVersions={pinnedEditorVersions}
                    updateMutation={updateMutation}
                    onClose={() => setShowModal(false)}
                />
            )}
        </ConfigurationSettingsField>
    );
};
