/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { useContext, useState } from "react";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { UserContext } from "../user-context";
import ConfirmationModal from "../components/ConfirmationModal";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { Button } from "../components/Button";
import { Heading2, Subheading } from "../components/typography/headings";
import Alert from "../components/Alert";

export default function Account() {
    const { user, setUser } = useContext(UserContext);
    const [modal, setModal] = useState(false);
    const primaryEmail = User.getPrimaryEmail(user!) || "";
    const [typedEmail, setTypedEmail] = useState("");
    const original = User.getProfile(user!);
    const [profileState, setProfileState] = useState(original);
    const [errorMessage, setErrorMessage] = useState("");
    const [updated, setUpdated] = useState(false);
    const canUpdateEmail = user && !User.isOrganizationOwned(user);

    const saveProfileState = () => {
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
            if (
                !/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
                    profileState.email.trim(),
                )
            ) {
                setErrorMessage("Please enter a valid email.");
                return;
            }
        }

        const updatedUser = User.setProfile(user!, profileState);
        setUser(updatedUser);
        getGitpodService().server.updateLoggedInUser(updatedUser);
        setUpdated(true);
    };

    const deleteAccount = async () => {
        await getGitpodService().server.deleteAccount();
        document.location.href = gitpodHostUrl.asApiLogout().toString();
    };

    const close = () => setModal(false);
    return (
        <div>
            <ConfirmationModal
                title="Delete Account"
                areYouSureText="You are about to permanently delete your account."
                buttonText="Delete Account"
                buttonDisabled={typedEmail !== primaryEmail}
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
                        saveProfileState();
                        e.preventDefault();
                    }}
                >
                    <ProfileInformation
                        profileState={profileState}
                        setProfileState={(state) => {
                            setProfileState(state);
                            setUpdated(false);
                        }}
                        errorMessage={errorMessage}
                        updated={updated}
                        emailIsReadonly={!canUpdateEmail}
                    >
                        <div className="flex flex-row mt-8">
                            <Button htmlType="submit" onClick={saveProfileState}>
                                Update Profile
                            </Button>
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
    profileState: User.Profile;
    setProfileState: (newState: User.Profile) => void;
    errorMessage: string;
    emailIsReadonly?: boolean;
    updated: boolean;
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
            {props.updated && (
                <Alert type="message" closable={true} className="mb-2 max-w-xl rounded-md">
                    Profile information has been updated.
                </Alert>
            )}
            <div className="flex flex-col lg:flex-row">
                <div>
                    <div className="mt-4">
                        <h4>Name</h4>
                        <input
                            type="text"
                            value={props.profileState.name}
                            onChange={(e) => props.setProfileState({ ...props.profileState, name: e.target.value })}
                        />
                    </div>
                    <div className="mt-4">
                        <h4>Email</h4>
                        <input
                            type="text"
                            value={props.profileState.email}
                            disabled={props.emailIsReadonly}
                            onChange={(e) => props.setProfileState({ ...props.profileState, email: e.target.value })}
                        />
                    </div>
                </div>
                <div className="lg:pl-14">
                    <div className="mt-4">
                        <h4>Avatar</h4>
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
