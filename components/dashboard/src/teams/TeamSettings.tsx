/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrganizationSettings } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import React, { Children, ReactNode, useCallback, useMemo, useState } from "react";
import Alert from "../components/Alert";
import ConfirmationModal from "../components/ConfirmationModal";
import { InputWithCopy } from "../components/InputWithCopy";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import { InputField } from "../components/forms/InputField";
import { TextInputField } from "../components/forms/TextInputField";
import { Heading2, Heading3, Subheading } from "../components/typography/headings";
import { useIsOwner } from "../data/organizations/members-query";
import { useOrgSettingsQuery } from "../data/organizations/org-settings-query";
import { useCurrentOrg, useOrganizationsInvalidator } from "../data/organizations/orgs-query";
import { useUpdateOrgMutation } from "../data/organizations/update-org-mutation";
import { useUpdateOrgSettingsMutation } from "../data/organizations/update-org-settings-mutation";
import { useOnBlurError } from "../hooks/use-onblur-error";
import { ReactComponent as Stack } from "../icons/Stack.svg";
import { organizationClient } from "../service/public-api";
import { gitpodHostUrl } from "../service/service";
import { useCurrentUser } from "../user-context";
import { OrgSettingsPage } from "./OrgSettingsPage";
import { ErrorCode } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { Button } from "@podkit/buttons/Button";
import { useInstallationDefaultWorkspaceImageQuery } from "../data/installation/default-workspace-image-query";
import { ConfigurationSettingsField } from "../repositories/detail/ConfigurationSettingsField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@podkit/select/Select";
import { useDocumentTitle } from "../hooks/use-document-title";

export default function TeamSettingsPage() {
    useDocumentTitle("Organization Settings - General");
    const user = useCurrentUser();
    const org = useCurrentOrg().data;
    const isOwner = useIsOwner();
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
            if (!isOwner) {
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
        [isOwner, orgFormIsValid, updateOrg, teamName],
    );

    const deleteTeam = useCallback(async () => {
        if (!org || !user) {
            return;
        }

        await organizationClient.deleteOrganization({ organizationId: org.id });
        invalidateOrgs();
        document.location.href = gitpodHostUrl.asDashboard().toString();
    }, [invalidateOrgs, org, user]);

    const { data: settings, isLoading } = useOrgSettingsQuery();
    const { data: installationDefaultImage } = useInstallationDefaultWorkspaceImageQuery();
    const updateTeamSettings = useUpdateOrgSettingsMutation();

    const [showImageEditModal, setShowImageEditModal] = useState(false);

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
                        <Heading2>General</Heading2>
                        <Subheading>
                            Set the default role and workspace image, name or delete your organization.
                        </Subheading>
                    </div>
                    <ConfigurationSettingsField>
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
                        <TextInputField
                            label="Display Name"
                            value={teamName}
                            error={teamNameError.message}
                            onChange={setTeamName}
                            disabled={!isOwner}
                            topMargin={false}
                            onBlur={teamNameError.onBlur}
                        />

                        {org && (
                            <InputField label="Organization ID">
                                <InputWithCopy value={org.id} tip="Copy Organization ID" />
                            </InputField>
                        )}

                        {isOwner && (
                            <Button
                                onClick={updateTeamInformation}
                                className="mt-4"
                                type="submit"
                                disabled={org?.name === teamName || !orgFormIsValid}
                            >
                                Save
                            </Button>
                        )}
                    </ConfigurationSettingsField>

                    <ConfigurationSettingsField>
                        <Heading3>Default role for joiners</Heading3>
                        <Subheading className="mb-4">Choose the initial role for new members.</Subheading>
                        <Select
                            value={`${settings?.defaultRole || "member"}`}
                            onValueChange={(value) => handleUpdateTeamSettings({ defaultRole: value })}
                            disabled={isLoading || !isOwner}
                        >
                            <SelectTrigger className="w-60">
                                <SelectValue placeholder="Select a branch filter" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={`owner`}>
                                    Owner - Can fully manage org and repository settings
                                </SelectItem>
                                <SelectItem value={`member`}>Member - Can view repository settings</SelectItem>
                                <SelectItem value={`collaborator`}>
                                    Collaborator - Can only create workspaces
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </ConfigurationSettingsField>

                    <ConfigurationSettingsField>
                        <Heading3>Workspace images</Heading3>
                        <Subheading>Choose a default image for all workspaces in the organization.</Subheading>

                        <WorkspaceImageButton
                            disabled={!isOwner}
                            settings={settings}
                            installationDefaultWorkspaceImage={installationDefaultImage}
                            onClick={() => setShowImageEditModal(true)}
                        />
                    </ConfigurationSettingsField>

                    {showImageEditModal && (
                        <OrgDefaultWorkspaceImageModal
                            settings={settings}
                            installationDefaultWorkspaceImage={installationDefaultImage}
                            onClose={() => setShowImageEditModal(false)}
                        />
                    )}

                    {user?.organizationId !== org?.id && isOwner && (
                        <ConfigurationSettingsField>
                            <Heading3>Delete organization</Heading3>
                            <Subheading className="pb-4 max-w-2xl">
                                Deleting this organization will also remove all associated data, including projects and
                                workspaces. Deleted organizations cannot be restored!
                            </Subheading>

                            <Button variant="destructive" onClick={() => setModal(true)}>
                                Delete Organization
                            </Button>
                        </ConfigurationSettingsField>
                    )}
                </div>
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

function WorkspaceImageButton(props: {
    settings?: OrganizationSettings;
    installationDefaultWorkspaceImage?: string;
    onClick: () => void;
    disabled?: boolean;
}) {
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

    const image = props.settings?.defaultWorkspaceImage || props.installationDefaultWorkspaceImage || "";

    const descList = useMemo(() => {
        const arr: ReactNode[] = [<span>Default image</span>];
        if (props.disabled) {
            arr.push(
                <>
                    Requires <span className="font-medium">Owner</span> permissions to change
                </>,
            );
        }
        return arr;
    }, [props.disabled]);

    const renderedDescription = useMemo(() => {
        return Children.toArray(descList).reduce((acc: ReactNode[], child, index) => {
            acc.push(child);
            if (index < descList.length - 1) {
                acc.push(<>&nbsp;&middot;&nbsp;</>);
            }
            return acc;
        }, []);
    }, [descList]);

    return (
        <InputField disabled={props.disabled} className="w-full max-w-lg">
            <div className="flex flex-col bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                    <div className="flex-1 flex items-center overflow-hidden h-8" title={image}>
                        <span className="w-5 h-5 mr-1">
                            <Stack />
                        </span>
                        <span className="truncate font-medium text-gray-700 dark:text-gray-200">
                            {parseDockerImage(image).repository}
                        </span>
                        &nbsp;&middot;&nbsp;
                        <span className="truncate text-gray-500 dark:text-gray-400">{parseDockerImage(image).tag}</span>
                    </div>
                    {!props.disabled && (
                        <Button variant="link" onClick={props.onClick}>
                            Change
                        </Button>
                    )}
                </div>
                {descList.length > 0 && (
                    <div className="mx-6 text-gray-400 dark:text-gray-500 truncate">{renderedDescription}</div>
                )}
            </div>
        </InputField>
    );
}

interface OrgDefaultWorkspaceImageModalProps {
    installationDefaultWorkspaceImage: string | undefined;
    settings: OrganizationSettings | undefined;
    onClose: () => void;
}

function OrgDefaultWorkspaceImageModal(props: OrgDefaultWorkspaceImageModalProps) {
    const [errorMsg, setErrorMsg] = useState("");
    const [defaultWorkspaceImage, setDefaultWorkspaceImage] = useState(props.settings?.defaultWorkspaceImage || "");
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
                if (!ErrorCode.isUserError(error["code"])) {
                    console.error(error);
                }
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
                    <span className="font-medium">Warning:</span> You are setting a default image for all workspaces
                    within the organization.
                </Alert>
                {errorMsg.length > 0 && (
                    <Alert type="error" className="mb-2">
                        {errorMsg}
                    </Alert>
                )}
                <div className="mt-4">
                    <TextInputField
                        label="Default Image"
                        hint="Use any official or custom workspace image from Docker Hub or any private container registry that the Gitpod instance can access."
                        placeholder={props.installationDefaultWorkspaceImage}
                        value={defaultWorkspaceImage}
                        onChange={setDefaultWorkspaceImage}
                    />
                </div>
            </ModalBody>
            <ModalFooter>
                <Button type="submit">Update Workspace Default Image</Button>
            </ModalFooter>
        </Modal>
    );
}
