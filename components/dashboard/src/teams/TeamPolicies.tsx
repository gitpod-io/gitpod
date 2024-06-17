/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { isGitpodIo } from "../utils";
import { OrganizationSettings } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import React, { useCallback, useMemo, useState } from "react";
import Alert from "../components/Alert";
import { CheckboxInputField } from "../components/forms/CheckboxInputField";
import { Heading2, Heading3, Subheading } from "../components/typography/headings";
import { useIsOwner } from "../data/organizations/members-query";
import { useOrgSettingsQuery } from "../data/organizations/org-settings-query";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { useUpdateOrgSettingsMutation } from "../data/organizations/update-org-settings-mutation";
import { OrgSettingsPage } from "./OrgSettingsPage";
import { Button } from "@podkit/buttons/Button";
import { useAllowedWorkspaceClassesMemo } from "../data/workspaces/workspace-classes-query";
import { ConfigurationSettingsField } from "../repositories/detail/ConfigurationSettingsField";
import {
    WorkspaceClassesModifyModal,
    WorkspaceClassesModifyModalProps,
    WorkspaceClassesOptions,
} from "../components/WorkspaceClassesOptions";
import { useMutation } from "@tanstack/react-query";
import { useAllowedWorkspaceEditorsMemo } from "../data/ide-options/ide-options-query";
import { IdeOptions, IdeOptionsModifyModal, IdeOptionsModifyModalProps } from "../components/IdeOptions";
import { useDocumentTitle } from "../hooks/use-document-title";
import { LinkButton } from "@podkit/buttons/LinkButton";
import PillLabel from "../components/PillLabel";

export default function TeamPoliciesPage() {
    useDocumentTitle("Organization Settings - Policies");
    const org = useCurrentOrg().data;
    const isOwner = useIsOwner();

    const { data: settings, isLoading } = useOrgSettingsQuery();
    const updateTeamSettings = useUpdateOrgSettingsMutation();

    const handleUpdateTeamSettings = useCallback(
        async (newSettings: Partial<OrganizationSettings>, options?: { throwMutateError?: boolean }) => {
            if (!org?.id) {
                throw new Error("no organization selected");
            }
            if (!isOwner) {
                throw new Error("no organization settings change permission");
            }
            try {
                await updateTeamSettings.mutateAsync({
                    ...settings,
                    ...newSettings,
                });
            } catch (error) {
                if (options?.throwMutateError) {
                    throw error;
                }
                console.error(error);
            }
        },
        [updateTeamSettings, org?.id, isOwner, settings],
    );

    return (
        <>
            <OrgSettingsPage>
                <div className="space-y-8">
                    <div>
                        <Heading2>Policies</Heading2>
                        <Subheading>
                            Restrict workspace classes, editors and sharing across your organization.
                        </Subheading>
                    </div>

                    <ConfigurationSettingsField>
                        <Heading3>Collaboration and sharing</Heading3>

                        {updateTeamSettings.isError && (
                            <Alert type="error" closable={true} className="mb-2 max-w-xl rounded-md">
                                <span>Failed to update organization settings: </span>
                                <span>{updateTeamSettings.error.message || "unknown error"}</span>
                            </Alert>
                        )}

                        <CheckboxInputField
                            label="Workspace Sharing"
                            hint="Allow workspaces created within an Organization to share the workspace with any authenticated user."
                            checked={!settings?.workspaceSharingDisabled}
                            onChange={(checked) => handleUpdateTeamSettings({ workspaceSharingDisabled: !checked })}
                            disabled={isLoading || !isOwner}
                        />
                    </ConfigurationSettingsField>

                    <OrgWorkspaceClassesOptions
                        isOwner={isOwner}
                        settings={settings}
                        handleUpdateTeamSettings={handleUpdateTeamSettings}
                    />

                    {isGitpodIo() && <WorkspaceClassesEnterpriseCallout />}

                    <EditorOptions
                        isOwner={isOwner}
                        settings={settings}
                        handleUpdateTeamSettings={handleUpdateTeamSettings}
                    />
                </div>
            </OrgSettingsPage>
        </>
    );
}

interface OrgWorkspaceClassesOptionsProps {
    isOwner: boolean;
    settings?: OrganizationSettings;
    handleUpdateTeamSettings: (
        newSettings: Partial<OrganizationSettings>,
        options?: { throwMutateError?: boolean },
    ) => Promise<void>;
}
const OrgWorkspaceClassesOptions = ({
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

interface EditorOptionsProps {
    settings: OrganizationSettings | undefined;
    isOwner: boolean;
    handleUpdateTeamSettings: (
        newSettings: Partial<OrganizationSettings>,
        options?: { throwMutateError?: boolean },
    ) => Promise<void>;
}
const EditorOptions = ({ isOwner, settings, handleUpdateTeamSettings }: EditorOptionsProps) => {
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

const WorkspaceClassesEnterpriseCallout = () => {
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
