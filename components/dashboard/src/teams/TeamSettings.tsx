/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrganizationSettings } from "@gitpod/gitpod-protocol";
import React, { useCallback, useState, useEffect } from "react";
import Alert from "../components/Alert";
import { Button } from "../components/Button";
import { CheckboxInputField } from "../components/forms/CheckboxInputField";
import ConfirmationModal from "../components/ConfirmationModal";
import { TextInputField } from "../components/forms/TextInputField";
import { Heading2, Subheading } from "../components/typography/headings";
import { useUpdateOrgSettingsMutation } from "../data/organizations/update-org-settings-mutation";
import { useOrgSettingsQuery } from "../data/organizations/org-settings-query";
import { OrganizationInfo, useCurrentOrg, useOrganizationsInvalidator } from "../data/organizations/orgs-query";
import { useUpdateOrgMutation } from "../data/organizations/update-org-mutation";
import { useOnBlurError } from "../hooks/use-onblur-error";
import { teamsService } from "../service/public-api";
import { gitpodHostUrl } from "../service/service";
import { useCurrentUser } from "../user-context";
import { OrgSettingsPage } from "./OrgSettingsPage";
import { useToast } from "../components/toasts/Toasts";

export default function TeamSettingsPage() {
    const user = useCurrentUser();
    const org = useCurrentOrg().data;
    const invalidateOrgs = useOrganizationsInvalidator();
    const [modal, setModal] = useState(false);
    const [teamNameToDelete, setTeamNameToDelete] = useState("");
    const [teamName, setTeamName] = useState(org?.name || "");
    const [updated, setUpdated] = useState(false);
    const updateOrg = useUpdateOrgMutation();

    const close = () => setModal(false);

    const teamNameError = useOnBlurError(
        teamName.length > 32
            ? "Organization name must not be longer than 32 characters"
            : "Organization name can not be blank",
        !!teamName && teamName.length <= 32,
    );

    const orgFormIsValid = teamNameError.isValid;

    const updateTeamInformation = useCallback(
        async (e: React.FormEvent) => {
            if (!org?.isOwner) {
                return;
            }
            e.preventDefault();

            if (!orgFormIsValid) {
                return;
            }

            try {
                await updateOrg.mutateAsync({ name: teamName });
                setUpdated(true);
                setTimeout(() => setUpdated(false), 3000);
            } catch (error) {
                console.error(error);
            }
        },
        [orgFormIsValid, updateOrg, teamName, org],
    );

    const deleteTeam = useCallback(async () => {
        if (!org || !user) {
            return;
        }

        await teamsService.deleteTeam({ teamId: org.id });
        invalidateOrgs();
        document.location.href = gitpodHostUrl.asDashboard().toString();
    }, [invalidateOrgs, org, user]);

    return (
        <>
            <OrgSettingsPage>
                <Heading2>Organization Details</Heading2>
                <Subheading className="max-w-2xl">Details of your organization within Gitpod.</Subheading>

                {updateOrg.isError && (
                    <Alert type="error" closable={true} className="mb-2 max-w-xl rounded-md">
                        <span>Failed to update organization information: </span>
                        <span>{updateOrg.error.message || "unknown error"}</span>
                    </Alert>
                )}
                {updated && (
                    <Alert type="message" closable={true} className="mb-2 max-w-xl rounded-md">
                        Organization name has been updated.
                    </Alert>
                )}
                <form onSubmit={updateTeamInformation}>
                    <TextInputField
                        label="Name"
                        hint="The name of your company or organization"
                        value={teamName}
                        error={teamNameError.message}
                        onChange={setTeamName}
                        disabled={!org?.isOwner}
                        onBlur={teamNameError.onBlur}
                    />

                    {org?.isOwner && (
                        <Button className="mt-4" htmlType="submit" disabled={org?.name === teamName || !orgFormIsValid}>
                            Update Organization
                        </Button>
                    )}
                </form>

                <OrgSettingsForm org={org} />

                {user?.organizationId !== org?.id && org?.isOwner && (
                    <>
                        <Heading2 className="pt-12">Delete Organization</Heading2>
                        <Subheading className="pb-4 max-w-2xl">
                            Deleting this organization will also remove all associated data, including projects and
                            workspaces. Deleted organizations cannot be restored!
                        </Subheading>

                        <button className="danger secondary" onClick={() => setModal(true)}>
                            Delete Organization
                        </button>
                    </>
                )}
            </OrgSettingsPage>

            <ConfirmationModal
                title="Delete Organization"
                buttonText="Delete Organization"
                buttonDisabled={teamNameToDelete !== org?.name}
                visible={modal}
                warningHead="Warning"
                warningText="This action cannot be reversed."
                onClose={close}
                onConfirm={deleteTeam}
            >
                <p className="text-base text-gray-500">
                    You are about to permanently delete <b>{org?.name}</b> including all associated data.
                </p>
                <ol className="text-gray-500 text-m list-outside list-decimal">
                    <li className="ml-5">
                        All <b>projects</b> added in this organization will be deleted and cannot be restored
                        afterwards.
                    </li>
                    <li className="ml-5">
                        All <b>members</b> of this organization will lose access to this organization, associated
                        projects and workspaces.
                    </li>
                    <li className="ml-5">Any free credit allowances granted to this organization will be lost.</li>
                </ol>
                <p className="pt-4 pb-2 text-gray-600 dark:text-gray-400 text-base font-semibold">
                    Type <code>{org?.name}</code> to confirm
                </p>
                <input
                    autoFocus
                    className="w-full"
                    type="text"
                    onChange={(e) => setTeamNameToDelete(e.target.value)}
                ></input>
            </ConfirmationModal>
        </>
    );
}

function OrgSettingsForm(props: { org?: OrganizationInfo }) {
    const { org } = props;
    const { data: settings, isLoading } = useOrgSettingsQuery();
    const updateTeamSettings = useUpdateOrgSettingsMutation();
    const [defaultWorkspaceImage, setDefaultWorkspaceImage] = useState(settings?.defaultWorkspaceImage ?? "");
    const { toast } = useToast();

    useEffect(() => {
        if (!settings) {
            return;
        }
        setDefaultWorkspaceImage(settings.defaultWorkspaceImage ?? "");
    }, [settings]);

    const handleUpdateTeamSettings = useCallback(
        async (newSettings: Partial<OrganizationSettings>) => {
            if (!org?.id) {
                throw new Error("no organization selected");
            }
            if (!org.isOwner) {
                throw new Error("no organization settings change permission");
            }
            try {
                await updateTeamSettings.mutateAsync({
                    ...settings,
                    ...newSettings,
                });
                if (newSettings.defaultWorkspaceImage) {
                    toast("Default workspace image has been updated.");
                }
            } catch (error) {
                console.error(error);
                toast(
                    error.message
                        ? "Failed to update organization settings: " + error.message
                        : "Oh no, there was a problem with our service.",
                );
            }
        },
        [updateTeamSettings, org?.id, org?.isOwner, settings, toast],
    );

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                handleUpdateTeamSettings({ defaultWorkspaceImage });
            }}
        >
            <Heading2 className="pt-12">Collaboration & Sharing</Heading2>
            <Subheading className="max-w-2xl">
                Choose which workspace images you want to use for your workspaces.
            </Subheading>

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
                disabled={isLoading || !org?.isOwner}
            />

            <Heading2 className="pt-12">Workspace Settings</Heading2>
            <TextInputField
                label="Default Image"
                // TODO: Provide document links
                hint="Use any official Gitpod Docker image, or Docker image reference"
                value={defaultWorkspaceImage}
                onChange={setDefaultWorkspaceImage}
                disabled={isLoading || !org?.isOwner}
            />

            {org?.isOwner && (
                <Button htmlType="submit" className="mt-4" disabled={!org.isOwner}>
                    Update Default Image
                </Button>
            )}
        </form>
    );
}
