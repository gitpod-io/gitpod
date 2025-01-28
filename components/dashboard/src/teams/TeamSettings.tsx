/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PlainMessage } from "@bufbuild/protobuf";
import { EnvVar } from "@gitpod/gitpod-protocol";
import { ErrorCode } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { OrganizationSettings } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { Button } from "@podkit/buttons/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@podkit/select/Select";
import { SwitchInputField } from "@podkit/switch/Switch";
import { Heading2, Heading3, Subheading } from "@podkit/typography/Headings";
import React, { Children, ReactNode, useCallback, useMemo, useState } from "react";
import Alert from "../components/Alert";
import ConfirmationModal from "../components/ConfirmationModal";
import { InputWithCopy } from "../components/InputWithCopy";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import { InputField } from "../components/forms/InputField";
import { TextInputField } from "../components/forms/TextInputField";
import { useToast } from "../components/toasts/Toasts";
import { useFeatureFlag } from "../data/featureflag-query";
import { useInstallationDefaultWorkspaceImageQuery } from "../data/installation/default-workspace-image-query";
import { useIsOwner } from "../data/organizations/members-query";
import { useListOrganizationEnvironmentVariables } from "../data/organizations/org-envvar-queries";
import { useOrgSettingsQuery } from "../data/organizations/org-settings-query";
import { useCurrentOrg, useOrganizationsInvalidator } from "../data/organizations/orgs-query";
import { useUpdateOrgMutation } from "../data/organizations/update-org-mutation";
import { useUpdateOrgSettingsMutation } from "../data/organizations/update-org-settings-mutation";
import { useDocumentTitle } from "../hooks/use-document-title";
import { useOnBlurError } from "../hooks/use-onblur-error";
import { ReactComponent as Stack } from "../icons/Stack.svg";
import { ConfigurationSettingsField } from "../repositories/detail/ConfigurationSettingsField";
import { organizationClient } from "../service/public-api";
import { gitpodHostUrl } from "../service/service";
import { useCurrentUser } from "../user-context";
import { OrgSettingsPage } from "./OrgSettingsPage";
import { NamedOrganizationEnvvarItem } from "./variables/NamedOrganizationEnvvarItem";

export default function TeamSettingsPage() {
    useDocumentTitle("Organization Settings - General");
    const { toast } = useToast();
    const user = useCurrentUser();
    const org = useCurrentOrg().data;
    const isOwner = useIsOwner();
    const invalidateOrgs = useOrganizationsInvalidator();

    const [modal, setModal] = useState(false);
    const [teamNameToDelete, setTeamNameToDelete] = useState("");
    const [teamName, setTeamName] = useState(org?.name || "");
    const [updated, setUpdated] = useState(false);

    const orgEnvVars = useListOrganizationEnvironmentVariables(org?.id || "");
    const gitpodImageAuthEnvVar = orgEnvVars.data?.find((v) => v.name === EnvVar.GITPOD_IMAGE_AUTH_ENV_VAR_NAME);

    const updateOrg = useUpdateOrgMutation();
    const isCommitAnnotationEnabled = useFeatureFlag("commit_annotation_setting_enabled");

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
        async (newSettings: Partial<PlainMessage<OrganizationSettings>>, options?: { throwMutateError?: boolean }) => {
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
                toast("Organization settings updated");
            } catch (error) {
                if (options?.throwMutateError) {
                    throw error;
                }
                toast(`Failed to update organization settings: ${error.message}`);
                console.error(error);
            }
        },
        [updateTeamSettings, org?.id, isOwner, settings, toast],
    );

    const handleUpdateAnnotatedCommits = useCallback(
        async (value: boolean) => {
            try {
                await handleUpdateTeamSettings({ annotateGitCommits: value });
            } catch (error) {
                console.error(error);
            }
        },
        [handleUpdateTeamSettings],
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

                    {org?.id && (
                        <ConfigurationSettingsField>
                            <Heading3>Docker Registry authentication</Heading3>
                            <Subheading>Configure Docker registry permissions for the whole organization.</Subheading>

                            <NamedOrganizationEnvvarItem
                                disabled={!isOwner}
                                name={EnvVar.GITPOD_IMAGE_AUTH_ENV_VAR_NAME}
                                organizationId={org.id}
                                variable={gitpodImageAuthEnvVar}
                            />
                        </ConfigurationSettingsField>
                    )}

                    {showImageEditModal && (
                        <OrgDefaultWorkspaceImageModal
                            settings={settings}
                            installationDefaultWorkspaceImage={installationDefaultImage}
                            onClose={() => setShowImageEditModal(false)}
                        />
                    )}

                    {isCommitAnnotationEnabled && (
                        <ConfigurationSettingsField>
                            <Heading3>Insights</Heading3>
                            <Subheading className="mb-4">
                                Configure insights into usage of Gitpod in your organization.
                            </Subheading>

                            <InputField
                                label="Annotate git commits"
                                hint={
                                    <>
                                        Add a <code>Tool:</code> field to all git commit messages created from
                                        workspaces in your organization to associate them with this Gitpod instance.
                                    </>
                                }
                                id="annotate-git-commits"
                            >
                                <SwitchInputField
                                    id="annotate-git-commits"
                                    checked={settings?.annotateGitCommits || false}
                                    disabled={!isOwner || isLoading}
                                    onCheckedChange={handleUpdateAnnotatedCommits}
                                    label=""
                                />
                            </InputField>
                        </ConfigurationSettingsField>
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
                <div className="text-pk-content-secondary">
                    <p className="text-base">
                        You are about to permanently delete <b>{org?.name}</b> including all associated data.
                    </p>
                    <ol className="text-m list-outside list-decimal">
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
                    <p className="pt-4 pb-2 text-base font-semibold text-pk-content-secondary">
                        Type <code>{org?.name}</code> to confirm
                    </p>
                    <input
                        autoFocus
                        className="w-full"
                        type="text"
                        onChange={(e) => setTeamNameToDelete(e.target.value)}
                    ></input>
                </div>
            </ConfirmationModal>
        </>
    );
}
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

function WorkspaceImageButton(props: {
    settings?: OrganizationSettings;
    installationDefaultWorkspaceImage?: string;
    onClick: () => void;
    disabled?: boolean;
}) {
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
            <div className="flex flex-col bg-pk-surface-secondary p-3 rounded-lg">
                <div className="flex items-center justify-between">
                    <div className="flex-1 flex items-center overflow-hidden h-8" title={image}>
                        <span className="w-5 h-5 mr-1">
                            <Stack />
                        </span>
                        <span className="truncate font-medium text-pk-content-secondary">
                            {parseDockerImage(image).repository}
                        </span>
                        &nbsp;&middot;&nbsp;
                        <span className="truncate text-pk-content-tertiary">{parseDockerImage(image).tag}</span>
                    </div>
                    {!props.disabled && (
                        <Button variant="link" onClick={props.onClick}>
                            Change
                        </Button>
                    )}
                </div>
                {descList.length > 0 && (
                    <div className="mx-6 text-pk-content-tertiary truncate">{renderedDescription}</div>
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
