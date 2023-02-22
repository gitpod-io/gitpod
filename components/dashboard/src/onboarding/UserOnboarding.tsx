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
                        <StepOrgInfo
                            user={user}
                            onComplete={(updatedUser) => {
                                setUser(updatedUser);
                                setStep(STEPS.THREE);
                            }}
                        />
                    )}
                    {step === STEPS.THREE && (
                        <StepPersonalize
                            user={user}
                            onComplete={(updatedUser) => {
                                setUser(updatedUser);
                                // TODO: should be able to remove this once state that shows this flow is updated
                                history.push("/workspaces");
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
export default UserOnboarding;
