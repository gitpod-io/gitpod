/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { hoursBefore, isDateSmaller } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import React, { useContext, useState } from "react";
import Alert from "../components/Alert";
import Modal from "../components/Modal";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import { isGitpodIo } from "../utils";

export namespace ProfileState {
    function shouldNudgeForUpdate(user: User): boolean {
        if (!isGitpodIo()) {
            return false;
        }
        if (!user.additionalData?.profile) {
            // never updated profile information and account is older than 24 hours (i.e. ask on second day).
            return !isDateSmaller(hoursBefore(new Date().toISOString(), 24), user.creationDate);
        }
        // if the profile wasn't updated for 12 months ask again.
        return !(
            !!user.additionalData.profile.lastUpdatedDetailsNudge &&
            isDateSmaller(
                hoursBefore(new Date().toISOString(), 24 * 365),
                user.additionalData.profile.lastUpdatedDetailsNudge,
            )
        );
    }

    /**
     * @param state
     * @returns error message or empty string when valid
     */
    export function validate(state: User.Profile): string {
        if (state.name.trim() === "") {
            return "Name must not be empty.";
        }
        if (state.email.trim() === "") {
            return "Email must not be empty.";
        }
        if (
            !/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
                state.email.trim(),
            )
        ) {
            return "Please enter a valid email.";
        }
        return "";
    }

    export function NudgeForProfileUpdateModal() {
        const { user, setUser } = useContext(UserContext);
        const original = User.getProfile(user!);
        const [profileState, setProfileState] = useState(original);
        const [errorMessage, setErrorMessage] = useState("");
        const [visible, setVisible] = useState(shouldNudgeForUpdate(user!));

        const saveProfileState = () => {
            const error = ProfileState.validate(profileState);
            setErrorMessage(error);
            if (error) {
                return;
            }
            const updatedUser = User.setProfile(user!, profileState);
            setUser(updatedUser);
            getGitpodService().server.updateLoggedInUser(updatedUser);
            setVisible(shouldNudgeForUpdate(updatedUser!));
        };

        const cancelProfileUpdate = () => {
            setProfileState(original);
            saveProfileState();
        };

        return (
            <Modal
                title="Update Profile Information"
                visible={visible}
                onClose={cancelProfileUpdate}
                closeable={true}
                className="_max-w-xl"
                buttons={
                    <div>
                        <button className="secondary" onClick={cancelProfileUpdate}>
                            Dismiss
                        </button>
                        <button className="ml-2" onClick={saveProfileState}>
                            Update Profile
                        </button>
                    </div>
                }
            >
                <ProfileInformation
                    profileState={profileState}
                    errorMessage={errorMessage}
                    updated={false}
                    setProfileState={setProfileState}
                />
            </Modal>
        );
    }
}

export default function ProfileInformation(props: {
    profileState: User.Profile;
    setProfileState: (newState: User.Profile) => void;
    errorMessage: string;
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
                            onChange={(e) => props.setProfileState({ ...props.profileState, email: e.target.value })}
                        />
                    </div>
                    <div className="mt-4">
                        <h4>Company</h4>
                        <input
                            type="text"
                            value={props.profileState.company}
                            onChange={(e) => props.setProfileState({ ...props.profileState, company: e.target.value })}
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
