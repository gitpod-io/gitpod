/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { LinkedInProfile } from "@gitpod/gitpod-protocol";
import { FC, useCallback, useState } from "react";
import { TextInputField } from "../components/forms/TextInputField";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";
import { useOnBlurError } from "../hooks/use-onblur-error";
import { OnboardingStep } from "./OnboardingStep";
import { LinkedInBanner } from "./LinkedInBanner";
import { User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { getPrimaryEmail } from "@gitpod/public-api-common/lib/user-utils";

type Props = {
    user: User;
    onComplete(user: User): void;
};
export const StepUserInfo: FC<Props> = ({ user, onComplete }) => {
    const updateUser = useUpdateCurrentUserMutation();
    // attempt to split provided name for default input values
    const { first, last } = getInitialNameParts(user);

    const [firstName, setFirstName] = useState(first);
    const [lastName, setLastName] = useState(last);
    // Email purposefully not pre-filled
    const [emailAddress, setEmailAddress] = useState("");

    const handleSubmit = useCallback(async () => {
        const updates = {
            // we only split these out currently for form collection, but combine in the db
            fullName: `${firstName} ${lastName}`,
            additionalData: {
                profile: {
                    // If still no email provided, default to "primary" email
                    emailAddress: emailAddress || getPrimaryEmail(user),
                    lastUpdatedDetailsNudge: new Date().toISOString(),
                },
            },
        };

        try {
            const updatedUser = await updateUser.mutateAsync(updates);
            onComplete(updatedUser);
        } catch (e) {
            console.error(e);
        }
    }, [emailAddress, firstName, lastName, onComplete, updateUser, user]);

    const onLinkedInSuccess = useCallback(
        async (profile: LinkedInProfile) => {
            if (!firstName && profile.firstName) {
                setFirstName(profile.firstName);
            }
            if (!lastName && profile.lastName) {
                setLastName(profile.lastName);
            }
            if (!emailAddress && profile.emailAddress) {
                setEmailAddress(profile.emailAddress);
            }
            handleSubmit();
        },
        [emailAddress, firstName, handleSubmit, lastName],
    );

    const firstNameError = useOnBlurError("Please enter a value", !!firstName);
    const lastNameError = useOnBlurError("Please enter a value", !!lastName);

    const isValid = [firstNameError, lastNameError].every((e) => e.isValid);

    return (
        <OnboardingStep
            title="Welcome to Gitpod"
            subtitle="You are one step away from shipping software faster."
            error={updateUser.isError ? "There was a problem updating your profile" : undefined}
            isValid={isValid}
            isSaving={updateUser.isLoading}
            onSubmit={handleSubmit}
            submitButtonText={"Continue with 10 hours per month"}
            submitButtonType={"secondary"}
        >
            {user.avatarUrl && (
                <div className="my-4 flex justify-center">
                    <img className="rounded-full w-24 h-24" src={user.avatarUrl} alt={user.name} />
                </div>
            )}

            <div className="flex justify-between space-x-2 w-full">
                <TextInputField
                    containerClassName="w-1/2"
                    value={firstName}
                    label="First name"
                    error={firstNameError.message}
                    onBlur={firstNameError.onBlur}
                    onChange={setFirstName}
                    required
                />

                <TextInputField
                    containerClassName="w-1/2"
                    value={lastName}
                    label="Last name"
                    error={lastNameError.message}
                    onBlur={lastNameError.onBlur}
                    onChange={setLastName}
                    required
                />
            </div>

            <LinkedInBanner onSuccess={onLinkedInSuccess} />
        </OnboardingStep>
    );
};

// Intentionally not using User.getName() here to avoid relying on identity.authName (likely not user's real name)
const getInitialNameParts = (user: User) => {
    const name = user.name || "";
    let first = name;
    let last = "";

    const parts = name.split(" ");
    if (parts.length > 1) {
        first = parts.shift() || "";
        last = parts.join(" ");
    }

    return { first, last };
};
