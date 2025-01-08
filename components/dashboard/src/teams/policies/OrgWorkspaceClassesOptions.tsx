/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrganizationSettings } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { Button } from "@podkit/buttons/Button";
import { useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Heading3, Subheading } from "../../components/typography/headings";
import {
    WorkspaceClassesModifyModalProps,
    WorkspaceClassesOptions,
    WorkspaceClassesModifyModal,
} from "../../components/WorkspaceClassesOptions";
import { useAllowedWorkspaceClassesMemo } from "../../data/workspaces/workspace-classes-query";
import { ConfigurationSettingsField } from "../../repositories/detail/ConfigurationSettingsField";

interface OrgWorkspaceClassesOptionsProps {
    isOwner: boolean;
    settings?: OrganizationSettings;
    handleUpdateTeamSettings: (
        newSettings: Partial<OrganizationSettings>,
        options?: { throwMutateError?: boolean },
    ) => Promise<void>;
}
export const OrgWorkspaceClassesOptions = ({
    isOwner,
    settings,
    handleUpdateTeamSettings,
}: OrgWorkspaceClassesOptionsProps) => {
    const [showModal, setShowModal] = useState(false);
    const { data: allowedClassesInOrganization, isLoading: isLoadingClsInOrg } = useAllowedWorkspaceClassesMemo(
        undefined,
        {
            filterOutDisabled: true,
            ignoreScope: ["configuration"],
        },
    );
    const { data: allowedClassesInInstallation, isLoading: isLoadingClsInInstall } = useAllowedWorkspaceClassesMemo(
        undefined,
        {
            filterOutDisabled: true,
            ignoreScope: ["organization", "configuration"],
        },
    );

    const restrictedWorkspaceClasses = useMemo(() => {
        const allowedList = settings?.allowedWorkspaceClasses ?? [];
        if (allowedList.length === 0) {
            return [];
        }
        return allowedClassesInInstallation.filter((cls) => !allowedList.includes(cls.id)).map((cls) => cls.id);
    }, [settings?.allowedWorkspaceClasses, allowedClassesInInstallation]);

    const updateMutation: WorkspaceClassesModifyModalProps["updateMutation"] = useMutation({
        mutationFn: async ({ restrictedWorkspaceClasses }) => {
            let allowedWorkspaceClasses = allowedClassesInInstallation.map((e) => e.id);
            if (restrictedWorkspaceClasses.length > 0) {
                allowedWorkspaceClasses = allowedWorkspaceClasses.filter(
                    (e) => !restrictedWorkspaceClasses.includes(e),
                );
            }
            const allAllowed = allowedClassesInInstallation.every((e) => allowedWorkspaceClasses.includes(e.id));
            if (allAllowed) {
                // empty means allow all classes
                allowedWorkspaceClasses = [];
            }
            await handleUpdateTeamSettings({ allowedWorkspaceClasses }, { throwMutateError: true });
        },
    });

    return (
        <ConfigurationSettingsField>
            <Heading3>Available workspace classes</Heading3>
            <Subheading>
                Limit the available workspace classes in your organization. Requires{" "}
                <span className="font-medium">Owner</span> permissions to change.
            </Subheading>

            <WorkspaceClassesOptions
                isLoading={isLoadingClsInOrg}
                className="mt-4"
                classes={allowedClassesInOrganization}
            />

            {isOwner && (
                <Button className="mt-6" onClick={() => setShowModal(true)}>
                    Manage Classes
                </Button>
            )}

            {showModal && (
                <WorkspaceClassesModifyModal
                    isLoading={isLoadingClsInInstall}
                    showSetDefaultButton={false}
                    showSwitchTitle={false}
                    restrictedWorkspaceClasses={restrictedWorkspaceClasses}
                    allowedClasses={allowedClassesInInstallation}
                    updateMutation={updateMutation}
                    onClose={() => setShowModal(false)}
                />
            )}
        </ConfigurationSettingsField>
    );
};
