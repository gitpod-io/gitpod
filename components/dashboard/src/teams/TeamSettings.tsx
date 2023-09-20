/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrganizationSettings } from "@gitpod/gitpod-protocol";
import React, { useCallback, useState } from "react";
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
import { useDefaultWorkspaceImageQuery } from "../data/workspaces/default-workspace-image-query";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import { InputField } from "../components/forms/InputField";
import { ReactComponent as Stack } from "../icons/Stack.svg";

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
    const { data: globalDefaultImage } = useDefaultWorkspaceImageQuery();
    const updateTeamSettings = useUpdateOrgSettingsMutation();

    const [showImageEditModal, setShowImageEditModal] = useState(false);

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
            } catch (error) {
                console.error(error);
            }
        },
        [updateTeamSettings, org?.id, org?.isOwner, settings],
    );

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                // handleUpdateTeamSettings({ defaultWorkspaceImage });
            }}
        >
            <Heading2 className="pt-12">Collaboration & Sharing</Heading2>

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

            <Heading2 className="pt-12">Workspace Images</Heading2>
            <Subheading className="max-w-2xl">
                Choose a default image for all workspaces in the organization.
            </Subheading>

            <WorkspaceImageButton
                disabled={!org?.isOwner}
                image={settings?.defaultWorkspaceImage ?? globalDefaultImage ?? ""}
                onClick={() => setShowImageEditModal(true)}
            />

            {showImageEditModal && (
                <OrgDefaultWorkspaceImageModal
                    settings={settings}
                    globalDefaultImage={globalDefaultImage}
                    onClose={() => setShowImageEditModal(false)}
                />
            )}
        </form>
    );
}

function WorkspaceImageButton(props: { image: string; onClick: () => void; disabled?: boolean }) {
    function parseDockerImage(image: string) {
        // https://docs.docker.com/registry/spec/api/
        let registry, repository, tag;
        let parts = image.split("/");

        if (parts.length > 1 && parts[0].includes(".")) {
            registry = parts.shift();
        } else {
            registry = "docker.io";
        }

        const remaining = parts.join("/");
        [repository, tag] = remaining.split(":");
        if (!tag) {
            tag = "latest";
        }
        return {
            registry,
            repository,
            tag,
        };
    }

    return (
        <InputField disabled={props.disabled} className="w-full max-w-lg">
            <div className="flex items-center bg-gray-50 dark:bg-gray-800 p-3 justify-between rounded-lg">
                <div className="flex items-center overflow-hidden" title={props.image}>
                    <span className="w-5 h-5 mr-1">
                        <Stack />
                    </span>
                    <span className="truncate">{parseDockerImage(props.image).repository}</span>
                    &nbsp;&middot;&nbsp;
                    <span className="flex-none w-16 truncate text-gray-500 dark:text-gray-500">
                        {parseDockerImage(props.image).tag}
                    </span>
                </div>
                <Button
                    disabled={props.disabled}
                    htmlType="button"
                    type="transparent"
                    className="text-blue-500"
                    onClick={props.onClick}
                >
                    Change
                </Button>
            </div>
        </InputField>
    );
}

interface OrgDefaultWorkspaceImageModalProps {
    globalDefaultImage: string | undefined;
    settings: OrganizationSettings | undefined;
    onClose: () => void;
}

function OrgDefaultWorkspaceImageModal(props: OrgDefaultWorkspaceImageModalProps) {
    const [errorMsg, setErrorMsg] = useState("");
    const [defaultWorkspaceImage, setDefaultWorkspaceImage] = useState(props.settings?.defaultWorkspaceImage ?? "");
    const updateTeamSettings = useUpdateOrgSettingsMutation();

    const handleUpdateTeamSettings = useCallback(
        async (newSettings: Partial<OrganizationSettings>) => {
            try {
                await updateTeamSettings.mutateAsync({
                    ...props.settings,
                    ...newSettings,
                });
                props.onClose();
            } catch (error) {
                console.error(error);
                setErrorMsg(error.message);
            }
        },
        [updateTeamSettings, props],
    );

    return (
        <Modal
            visible
            closeable
            onClose={props.onClose}
            onSubmit={() => handleUpdateTeamSettings({ defaultWorkspaceImage })}
        >
            <ModalHeader>Workspace Default Image</ModalHeader>
            <ModalBody>
                <Alert type="warning" className="mb-2">
                    Warning: You are setting a default image for all workspaces within the organization.
                </Alert>
                {errorMsg.length > 0 && (
                    <Alert type="error" className="mb-2">
                        {errorMsg}
                    </Alert>
                )}
                <div className="mt-4">
                    <TextInputField
                        label="Default Image"
                        hint="Use any official or custom workspaces images from Docker Hub or any private container registries this Gitpod instance can access."
                        placeholder={props.globalDefaultImage}
                        value={defaultWorkspaceImage}
                        onChange={setDefaultWorkspaceImage}
                    />
                </div>
            </ModalBody>
            <ModalFooter>
                <Button htmlType="submit">Update Workspace Default Image</Button>
            </ModalFooter>
        </Modal>
    );
}
