/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { FunctionComponent, useContext, useState } from "react";
import gitpodIcon from "../icons/gitpod.svg";
import Separator from "../components/Separator";
import { useHistory } from "react-router";
import { StepUserInfo } from "./StepUserInfo";
import { UserContext } from "../user-context";
import { StepOrgInfo } from "./StepOrgInfo";
import { StepPersonalize } from "./StepPersonalize";

const STEPS = {
    ONE: "one",
    TWO: "two",
    THREE: "three",
};
type Props = {
    user: User;
};
const UserOnboarding: FunctionComponent<Props> = ({ user }) => {
    const history = useHistory();
    const [step, setStep] = useState(STEPS.ONE);
    // TODO: Remove this once current user is behind react-query
    const { setUser } = useContext(UserContext);
    // const [profile, dispatch] = useReducer(
    //     (state: OnboardingProfileDetails, action: Partial<OnboardingProfileDetails>) => {
    //         return {
    //             ...state,
    //             ...action,
    //         };
    //     },
    //     getInitialProfileState(user),
    // );

    // const handleSubmit = useCallback(() => {
    //     console.log("Saving profile updates", profile);
    //     // TODO: add api calls to update profile

    //     // For now, send to workspaces once done
    //     // This will get updated though so we don't need to redirect and can leave them on their current page once complete
    //     history.push("/workspaces");
    // }, [history, profile]);

    return (
        <div className="container">
            <div className="app-container">
                <div className="flex items-center justify-center py-3">
                    <img src={gitpodIcon} className="h-6" alt="Gitpod's logo" />
                </div>
                <Separator />
                <div className="mt-24">
                    {step === STEPS.TWO && (
                        <StepUserInfo
                            user={user}
                            onComplete={(updatedUser) => {
                                setUser(updatedUser);
                                setStep(STEPS.TWO);
                                // history.push("/workspaces");
                            }}
                        />
                    )}
                    {step === STEPS.TWO && (
                        <StepOrgInfo
                            user={user}
                            onComplete={(updatedUser) => {
                                setUser(updatedUser);
                                setStep(STEPS.THREE);
                                history.push("/workspaces");
                            }}
                        />
                    )}
                    {step === STEPS.ONE && (
                        <StepPersonalize
                            user={user}
                            onComplete={(updatedUser) => {
                                setUser(updatedUser);
                                // setStep(STEPS.THREE);
                                history.push("/workspaces");
                            }}
                        />
                    )}

                    {/* {user.avatarUrl && (
                        <div className="mt-4">
                            <img
                                className="rounded-full w-24 h-24"
                                src={user.avatarUrl}
                                alt={user.fullName || user.name}
                            />
                        </div>
                    )}
                    <OnboardingForm profile={profile} onUpdate={dispatch} onSubmit={handleSubmit} /> */}
                </div>
            </div>
        </div>
    );
};
export default UserOnboarding;

// const getInitialNameParts = (user: User) => {
//     const name = user.fullName || user.name || "";
//     let firstName = name;
//     let lastName = "";

//     const parts = name.split(" ");
//     if (parts.length > 1) {
//         firstName = parts.shift() || "";
//         lastName = parts.join(" ");
//     }

//     return { firstName, lastName };
// };

// const getInitialProfileState = (user: User): OnboardingProfileDetails => {
//     const { firstName, lastName } = getInitialNameParts(user);

//     return {
//         firstName,
//         lastName,
//         emailAddress: user.additionalData?.profile?.emailAddress ?? "",
//         companyWebsite: user.additionalData?.profile?.companyWebsite ?? "",
//         jobRole: user.additionalData?.profile?.jobRole ?? "",
//         jobRoleOther: user.additionalData?.profile?.jobRoleOther ?? "",
//         signupGoals: user.additionalData?.profile?.signupGoals || "",
//         signupGoalsOther: user.additionalData?.profile?.signupGoalsOther ?? "",
//     };
// };
