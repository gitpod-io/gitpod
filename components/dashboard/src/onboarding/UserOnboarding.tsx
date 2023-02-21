/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { FunctionComponent, useCallback, useReducer } from "react";
import { OnboardingForm, OnboardingProfileDetails } from "./OnboardingForm";

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
            <h1>Welcome</h1>

            <p>Help us get to know you a bit better</p>
            <OnboardingForm profile={profile} onUpdate={dispatch} onSubmit={handleSubmit} />
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
