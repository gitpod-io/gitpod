/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrganizationSettings } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { Button } from "@podkit/buttons/Button";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { IdeOptionsModifyModalProps, IdeOptions, IdeOptionsModifyModal } from "../../components/IdeOptions";
import { Heading3, Subheading } from "../../components/typography/headings";
import { useAllowedWorkspaceEditorsMemo } from "../../data/ide-options/ide-options-query";
import { ConfigurationSettingsField } from "../../repositories/detail/ConfigurationSettingsField";

type Props = {
    settings: OrganizationSettings | undefined;
    isOwner: boolean;
    handleUpdateTeamSettings: (
        newSettings: Partial<OrganizationSettings>,
        options?: { throwMutateError?: boolean },
    ) => Promise<void>;
};
export const EditorOptions = ({ isOwner, settings, handleUpdateTeamSettings }: Props) => {
    const [showModal, setShowModal] = useState(false);
    const { data: installationOptions, isLoading: installationOptionsIsLoading } = useAllowedWorkspaceEditorsMemo(
        undefined,
        {
            filterOutDisabled: true,
            ignoreScope: ["organization", "configuration"],
        },
    );
    const { data: orgOptions, isLoading: orgOptionsIsLoading } = useAllowedWorkspaceEditorsMemo(undefined, {
        filterOutDisabled: true,
        ignoreScope: ["configuration"],
    });

    const updateMutation: IdeOptionsModifyModalProps["updateMutation"] = useMutation({
        mutationFn: async ({ restrictedEditors, pinnedEditorVersions }) => {
            const updatedRestrictedEditors = [...restrictedEditors.keys()];
            const updatedPinnedEditorVersions = Object.fromEntries(pinnedEditorVersions.entries());

            await handleUpdateTeamSettings(
                { restrictedEditorNames: updatedRestrictedEditors, pinnedEditorVersions: updatedPinnedEditorVersions },
                { throwMutateError: true },
            );
        },
    });

    const restrictedEditors = new Set<string>(settings?.restrictedEditorNames || []);
    const pinnedEditorVersions = new Map<string, string>(Object.entries(settings?.pinnedEditorVersions || {}));

    return (
        <ConfigurationSettingsField>
            <Heading3>Available editors</Heading3>
            <Subheading>
                Limit the available editors in your organization. Requires <span className="font-medium">Owner</span>{" "}
                permissions to change.
            </Subheading>

            <IdeOptions
                isLoading={orgOptionsIsLoading}
                className="mt-4"
                ideOptions={orgOptions}
                pinnedEditorVersions={pinnedEditorVersions}
            />

            {isOwner && (
                <Button className="mt-6" onClick={() => setShowModal(true)}>
                    Manage Editors
                </Button>
            )}

            {showModal && (
                <IdeOptionsModifyModal
                    isLoading={installationOptionsIsLoading}
                    ideOptions={installationOptions}
                    restrictedEditors={restrictedEditors}
                    pinnedEditorVersions={pinnedEditorVersions}
                    updateMutation={updateMutation}
                    onClose={() => setShowModal(false)}
                />
            )}
        </ConfigurationSettingsField>
    );
};
