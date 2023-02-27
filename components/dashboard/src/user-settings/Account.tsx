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
import ProfileInformation, { ProfileState } from "./ProfileInformation";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { Button } from "../components/Button";

export default function Account() {
    const { user, setUser } = useContext(UserContext);
    const [modal, setModal] = useState(false);
    const primaryEmail = User.getPrimaryEmail(user!) || "";
    const [typedEmail, setTypedEmail] = useState("");
    const original = User.getProfile(user!);
    const [profileState, setProfileState] = useState(original);
    const [errorMessage, setErrorMessage] = useState("");
    const [updated, setUpdated] = useState(false);

    const saveProfileState = () => {
        const error = ProfileState.validate(profileState);
        setErrorMessage(error);
        if (error) {
            return;
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
                <h3>Profile</h3>
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
                    >
                        <div className="flex flex-row mt-8">
                            <Button onClick={saveProfileState}>Update Profile</Button>
                        </div>
                    </ProfileInformation>
                </form>
                <h3 className="mt-12">Delete Account</h3>
                <p className="text-base text-gray-500 pb-4">
                    This action will remove all the data associated with your account in Gitpod.
                </p>
                <Button type="danger.secondary" onClick={() => setModal(true)}>
                    Delete Account
                </Button>
            </PageWithSettingsSubMenu>
        </div>
    );
}
