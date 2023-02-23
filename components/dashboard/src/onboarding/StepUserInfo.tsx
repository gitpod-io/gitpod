/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { FC, useCallback, useState } from "react";
import { TextInputField } from "../components/forms/TextInputField";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";
import { useOnBlurError } from "../hooks/use-onblur-error";
import { OnboardingStep } from "./OnboardingStep";

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
    const [emailAddress, setEmailAddress] = useState(User.getPrimaryEmail(user) ?? "");

    const handleSubmit = useCallback(async () => {
        const additionalData = user.additionalData || {};
        const profile = additionalData.profile || {};

        const updates = {
            // we only split these out currently for form collection, but combine in the db
            fullName: `${firstName} ${lastName}`,
            additionalData: {
                ...additionalData,
                profile: {
                    ...profile,
                    emailAddress,
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
    }, [emailAddress, firstName, lastName, onComplete, updateUser, user.additionalData]);

    const firstNameError = useOnBlurError("Please enter a value", !!firstName);
    const lastNameError = useOnBlurError("Please enter a value", !!lastName);
    const emailError = useOnBlurError("Please enter your email address", !!emailAddress);

    const isValid = [firstNameError, lastNameError, emailError].every((e) => e.isValid);

    return (
        <OnboardingStep
            title="Welcome to Gitpod"
            subtitle="You are one step away from shipping software faster."
            error={updateUser.isError ? "There was a problem updating your profile" : undefined}
            isValid={isValid}
            isSaving={updateUser.isLoading}
            onSubmit={handleSubmit}
        >
            {user.avatarUrl && (
                <div className="my-4 flex justify-center">
                    <img className="rounded-full w-24 h-24" src={user.avatarUrl} alt={user.fullName || user.name} />
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

            <TextInputField
                value={emailAddress}
                label="Email"
                type="email"
                hint="We recommend using a work email address."
                error={emailError.message}
                onBlur={emailError.onBlur}
                onChange={setEmailAddress}
                required
            />
        </OnboardingStep>
    );
};

// Intentionally not using User.getName() here to avoid relying on identity.authName (likely not user's real name)
const getInitialNameParts = (user: User) => {
    const name = user.fullName || user.name || "";
    let first = name;
    let last = "";

    const parts = name.split(" ");
    if (parts.length > 1) {
        first = parts.shift() || "";
        last = parts.join(" ");
    }

    return { first, last };
};
