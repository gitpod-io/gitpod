/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useState } from "react";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import ConfirmationModal from "../components/ConfirmationModal";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { Button } from "../components/Button";
import { Heading2, Subheading } from "../components/typography/headings";
import Alert from "../components/Alert";
import { TextInputField } from "../components/forms/TextInputField";
import isEmail from "validator/lib/isEmail";
import { useToast } from "../components/toasts/Toasts";
import { InputWithCopy } from "../components/InputWithCopy";
import { InputField } from "../components/forms/InputField";
import { useAuthenticatedUser } from "../data/current-user/authenticated-user-query";
import { getPrimaryEmail, getProfile, isOrganizationOwned } from "@gitpod/public-api-common/lib/user-utils";
import { User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { User as UserProtocol } from "@gitpod/gitpod-protocol";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";

export default function Account() {
    const { data: user, refetch: reloadUser } = useAuthenticatedUser();
    const [modal, setModal] = useState(false);
    const [typedEmail, setTypedEmail] = useState("");
    const original = getProfile(user!);
    const [profileState, setProfileState] = useState(original);
    const [errorMessage, setErrorMessage] = useState("");
    const canUpdateEmail = user && !isOrganizationOwned(user);
    const { toast } = useToast();
    const updateUser = useUpdateCurrentUserMutation();

    const saveProfileState = useCallback(async () => {
        if (!user || !profileState) {
            return;
        }

        if (profileState.name.trim() === "") {
            setErrorMessage("Name must not be empty.");
            return;
        }
        if (canUpdateEmail) {
            if (profileState.email.trim() === "") {
                setErrorMessage("Email must not be empty.");
                return;
            }
            // check valid email
            if (!isEmail(profileState.email.trim())) {
                setErrorMessage("Please enter a valid email.");
                return;
            }
        } else {
            profileState.email = getPrimaryEmail(user) || "";
        }

        await updateUser.mutateAsync({
            fullName: profileState.name,
            additionalData: {
                profile: profileState,
            },
        });
        reloadUser();
        toast("Your profile information has been updated.");
    }, [updateUser, canUpdateEmail, profileState, reloadUser, toast, user]);

    const deleteAccount = useCallback(async () => {
        await getGitpodService().server.deleteAccount();
        document.location.href = gitpodHostUrl.asApiLogout().toString();
    }, []);

    const close = () => setModal(false);
    return (
        <div>
            <ConfirmationModal
                title="Delete Account"
                areYouSureText="You are about to permanently delete your account."
                buttonText="Delete Account"
                buttonDisabled={typedEmail !== original.email}
                visible={modal}
                onClose={close}
                onConfirm={deleteAccount}
            >
                <ol className="text-gray-500 text-sm list-outside list-decimal">
                    <li className="ml-5">
                        All your workspaces and related data will be deleted and cannot be restored afterwards.
                    </li>
                    <li className="ml-5">
                        Your subscription will be cancelled. If you obtained a Gitpod subscription through the GitHub
                        marketplace, you need to cancel your plan there.
                    </li>
                </ol>
                <p className="pt-4 pb-2 text-gray-600 dark:text-gray-400 text-base font-semibold">
                    Type your email to confirm
                </p>
                <input autoFocus className="w-full" type="text" onChange={(e) => setTypedEmail(e.target.value)}></input>
            </ConfirmationModal>

            <PageWithSettingsSubMenu>
                <Heading2>Profile</Heading2>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        saveProfileState();
                    }}
                >
                    <ProfileInformation
                        profileState={profileState}
                        setProfileState={(state) => {
                            setProfileState(state);
                        }}
                        errorMessage={errorMessage}
                        emailIsReadonly={!canUpdateEmail}
                        user={user}
                    >
                        <div className="flex flex-row mt-8">
                            <Button htmlType="submit">Update Profile</Button>
                        </div>
                    </ProfileInformation>
                </form>
                <Heading2 className="mt-12">Delete Account</Heading2>
                <Subheading className="mb-3">
                    This action will remove all the data associated with your account in Gitpod.
                </Subheading>
                <Button type="danger.secondary" onClick={() => setModal(true)}>
                    Delete Account
                </Button>
            </PageWithSettingsSubMenu>
        </div>
    );
}

function ProfileInformation(props: {
    profileState: UserProtocol.Profile;
    setProfileState: (newState: UserProtocol.Profile) => void;
    errorMessage: string;
    emailIsReadonly?: boolean;
    user?: User;
    children?: React.ReactChild[] | React.ReactChild;
}) {
    return (
        <div>
            <p className="text-base text-gray-500 pb-4 max-w-xl">
                The following information will be used to set up Git configuration. You can override Git author name and
                email per project by using the default environment variables <code>GIT_AUTHOR_NAME</code>,{" "}
                <code>GIT_COMMITTER_NAME</code>, <code>GIT_AUTHOR_EMAIL</code> and <code>GIT_COMMITTER_EMAIL</code>.
            </p>
            {props.errorMessage.length > 0 && (
                <Alert type="error" closable={true} className="mb-2 max-w-xl rounded-md">
                    {props.errorMessage}
                </Alert>
            )}
            <div className="flex flex-col lg:flex-row">
                <fieldset>
                    <TextInputField
                        label="Name"
                        value={props.profileState.name}
                        onChange={(val) => props.setProfileState({ ...props.profileState, name: val })}
                    />
                    <TextInputField
                        label="Email"
                        value={props.profileState.email}
                        disabled={props.emailIsReadonly}
                        onChange={(val) => {
                            props.setProfileState({ ...props.profileState, email: val });
                        }}
                    />
                    {props.user && (
                        <InputField label="User ID">
                            <InputWithCopy value={props.user.id} tip="Copy User ID" />
                        </InputField>
                    )}
                </fieldset>
                <div className="lg:pl-14">
                    <div className="mt-4">
                        <Subheading>Avatar</Subheading>
                        <img
                            className="rounded-full w-24 h-24"
                            src={props.profileState.avatarURL}
                            alt={props.profileState.name}
                        />
                    </div>
                </div>
            </div>
            {props.children || null}
        </div>
    );
}
