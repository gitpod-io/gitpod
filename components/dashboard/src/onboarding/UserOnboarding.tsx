/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { FunctionComponent, useCallback, useContext, useState } from "react";
import gitpodIcon from "../icons/gitpod.svg";
import Separator from "../components/Separator";
import { useHistory, useLocation } from "react-router";
import { StepUserInfo } from "./StepUserInfo";
import { UserContext } from "../user-context";
import { StepOrgInfo } from "./StepOrgInfo";
import { StepPersonalize } from "./StepPersonalize";

// This param is optionally present to force an onboarding flow
// Can be used if other conditions aren't true, i.e. if user has already onboarded, but we want to force the flow again
export const FORCE_ONBOARDING_PARAM = "onboarding";
export const FORCE_ONBOARDING_PARAM_VALUE = "force";

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
    const location = useLocation();
    const [step, setStep] = useState(STEPS.ONE);
    // TODO: Remove this once current user is behind react-query
    const { setUser } = useContext(UserContext);

    const onboardingComplete = useCallback(
        (updatedUser: User) => {
            // Ideally this state update results in the onboarding flow being dismissed, we done.
            setUser(updatedUser);

            // Look for the `onboarding=force` query param, and remove if present
            const queryParams = new URLSearchParams(location.search);
            if (queryParams.get(FORCE_ONBOARDING_PARAM) === FORCE_ONBOARDING_PARAM_VALUE) {
                queryParams.delete(FORCE_ONBOARDING_PARAM);
                history.replace({
                    pathname: location.pathname,
                    search: queryParams.toString(),
                    hash: location.hash,
                });
            }
            // TODO: should be able to remove this once state that shows this flow is updated
            // history.push("/workspaces");
        },
        [history, location.hash, location.pathname, location.search, setUser],
    );

    return (
        <div className="container">
            <div className="app-container">
                <div className="flex items-center justify-center py-3">
                    <img src={gitpodIcon} className="h-6" alt="Gitpod's logo" />
                </div>
                <Separator />
                <div className="mt-24">
                    {step === STEPS.ONE && (
                        <StepUserInfo
                            user={user}
                            onComplete={(updatedUser) => {
                                setUser(updatedUser);
                                setStep(STEPS.TWO);
                            }}
                        />
                    )}
                    {step === STEPS.TWO && (
                        <StepPersonalize
                            user={user}
                            onComplete={(updatedUser) => {
                                setUser(updatedUser);
                                setStep(STEPS.THREE);
                            }}
                        />
                    )}
                    {step === STEPS.THREE && <StepOrgInfo user={user} onComplete={onboardingComplete} />}
                </div>
            </div>
        </div>
    );
};
export default UserOnboarding;
