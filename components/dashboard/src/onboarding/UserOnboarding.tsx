/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { FunctionComponent, useCallback, useContext, useState } from "react";
import gitpodIcon from "../icons/gitpod.svg";
import { Separator } from "../components/Separator";
import { useHistory, useLocation } from "react-router";
import { StepUserInfo } from "./StepUserInfo";
import { UserContext } from "../user-context";
import { StepOrgInfo } from "./StepOrgInfo";
import { StepPersonalize } from "./StepPersonalize";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";
import Alert from "../components/Alert";
import { useConfetti } from "../contexts/ConfettiContext";
import { trackEvent } from "../Analytics";

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
    const { setUser } = useContext(UserContext);
    const updateUser = useUpdateCurrentUserMutation();
    const { dropConfetti } = useConfetti();

    const [step, setStep] = useState(STEPS.ONE);
    const [completingError, setCompletingError] = useState("");

    // We track this state here so we can persist it at the end of the flow instead of when it's selected
    // This is because setting the ide is how we indicate a user has onboarded, and want to defer that until the end
    // even though we may ask for it earlier in the flow. The tradeoff is a potential error state at the end of the flow when updating the IDE
    const [ideOptions, setIDEOptions] = useState({ ide: "code", useLatest: false });

    // TODO: This logic can be simplified in the future if we put existing users through onboarding and track the onboarded timestamp
    // When onboarding is complete (last step finished), we do the following
    // * Update the user's IDE selection (current logic relies on this for considering a user onboarded, so we wait until the end)
    // * Set an user's onboarded timestamp
    // * Update the `user` context w/ the latest user, which will close out this onboarding flow
    const onboardingComplete = useCallback(
        async (updatedUser: User) => {
            try {
                const updates = {
                    additionalData: {
                        profile: {
                            onboardedTimestamp: new Date().toISOString(),
                        },
                        ideSettings: {
                            settingVersion: "2.0",
                            defaultIde: ideOptions.ide,
                            useLatestVersion: ideOptions.useLatest,
                        },
                    },
                };

                try {
                    // TODO: extract the IDE updating into it's own step, and add a mutation for it once we don't rely on it to consider a user being "onboarded"
                    // We can do this once we rely on the profile.onboardedTimestamp instead.
                    const onboardedUser = await updateUser.mutateAsync(updates);

                    // TODO: move this into a mutation side effect once we have a specific mutation for updating the IDE (see above TODO)
                    trackEvent("ide_configuration_changed", {
                        name: onboardedUser.editorSettings?.name,
                        version: onboardedUser.editorSettings?.version,
                        location: "onboarding",
                    });

                    dropConfetti();
                    setUser(onboardedUser);

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
                } catch (e) {
                    console.log("error caught", e);
                    console.error(e);
                    setCompletingError("There was a problem completing your onboarding");
                }
            } catch (e) {
                console.error(e);
            }
        },
        [
            history,
            ideOptions.ide,
            ideOptions.useLatest,
            location.hash,
            location.pathname,
            location.search,
            setUser,
            dropConfetti,
            updateUser,
        ],
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
                            onComplete={(ide, useLatest) => {
                                setIDEOptions({ ide, useLatest });
                                setStep(STEPS.THREE);
                            }}
                        />
                    )}
                    {step === STEPS.THREE && <StepOrgInfo user={user} onComplete={onboardingComplete} />}

                    {!!completingError && <Alert type="error">{completingError}</Alert>}
                </div>
            </div>
        </div>
    );
};
export default UserOnboarding;
