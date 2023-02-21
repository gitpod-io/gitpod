/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { FunctionComponent, useCallback, useReducer } from "react";
import { Link } from "react-router-dom";
import { OnboardingForm, OnboardingProfileDetails } from "./OnboardingForm";
import gitpodIcon from "../icons/gitpod.svg";
import Separator from "../components/Separator";

type Props = {
    user: User;
};
const UserOnboarding: FunctionComponent<Props> = ({ user }) => {
    // Placeholder UI to start stubbing out new flow

    const [profile, dispatch] = useReducer(
        (state: OnboardingProfileDetails, action: Partial<OnboardingProfileDetails>) => {
            return {
                ...state,
                ...action,
            };
        },
        getInitialProfileState(user),
    );

    const handleSubmit = useCallback(() => {
        console.log("Saving profile updates", profile);
    }, [profile]);

    return (
        <div className="container">
            <div className="app-container">
                <div className="flex items-center justify-center py-3">
                    <img src={gitpodIcon} className="h-6" alt="Gitpod's logo" />
                </div>
                <Separator />
                <div className="flex flex-col items-center w-max-lg mt-8">
                    <h1>Welcome to Gitpod</h1>

                    <p>Tell us more about your organization</p>

                    {user.avatarUrl && (
                        <div className="mt-4">
                            <img
                                className="rounded-full w-24 h-24"
                                src={user.avatarUrl}
                                alt={user.fullName || user.name}
                            />
                        </div>
                    )}
                    <OnboardingForm profile={profile} onUpdate={dispatch} onSubmit={handleSubmit} />
                </div>
            </div>
        </div>
    );
};
export default UserOnboarding;

const getInitialNameParts = (user: User) => {
    const name = user.fullName || user.name || "";
    let firstName = name;
    let lastName = "";

    const parts = name.split(" ");
    if (parts.length > 1) {
        firstName = parts.shift() || "";
        lastName = parts.join(" ");
    }

    return { firstName, lastName };
};

const getInitialProfileState = (user: User): OnboardingProfileDetails => {
    const { firstName, lastName } = getInitialNameParts(user);

    return {
        firstName,
        lastName,
        emailAddress: user.additionalData?.profile?.emailAddress ?? "",
        companyWebsite: user.additionalData?.profile?.companyWebsite ?? "",
        jobRole: user.additionalData?.profile?.jobRole ?? "",
        jobRoleOther: user.additionalData?.profile?.jobRoleOther ?? "",
        signupGoals: user.additionalData?.profile?.signupGoals || [],
        signupGoalsOther: user.additionalData?.profile?.signupGoalsOther ?? "",
    };
};
