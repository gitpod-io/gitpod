/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { FC, useCallback, useState } from "react";
import { TextInputField } from "../components/forms/TextInputField";
import { useOnBlurError } from "../hooks/use-onblur-error";
import { OnboardingStep } from "./OnboardingStep";

type Props = {
    user: User;
    onComplete(user: User): void;
};
export const StepUserInfo: FC<Props> = ({ user, onComplete }) => {
    // attempt to split provided name for default input values
    const { first, last } = getInitialNameParts(user);

    const [firstName, setFirstName] = useState(first);
    const [lastName, setLastName] = useState(last);
    const [emailAddress, setEmailAddress] = useState(user.additionalData?.profile?.emailAddress ?? "");

    const prepareUpdates = useCallback(() => {
        const additionalData = user.additionalData || {};
        const profile = additionalData.profile || {};

        return {
            // we only split these out currently for form collection, but combine in the db
            fullName: `${firstName} ${lastName}`,
            additionalData: {
                ...additionalData,
                profile: {
                    ...profile,
                    emailAddress,
                },
            },
        };
    }, [emailAddress, firstName, lastName, user.additionalData]);

    const firstNameError = useOnBlurError("Please enter a value", !!firstName);
    const lastNameError = useOnBlurError("Please enter a value", !!lastName);
    const emailError = useOnBlurError("Please enter your email address", !!emailAddress);

    const isValid = [firstNameError, lastNameError, emailError].every((e) => e.isValid);

    return (
        <OnboardingStep
            title="Get started with Gitpod"
            subtitle="Fill in the name and email you want to use to author commits."
            isValid={isValid}
            prepareUpdates={prepareUpdates}
            onUpdated={onComplete}
        >
            <div className="flex justify-between space-x-2 w-full">
                <TextInputField
                    containerClassName="w-1/2"
                    value={firstName}
                    label="First name"
                    error={firstNameError.message}
                    onBlur={firstNameError.onBlur}
                    onChange={setFirstName}
                />

                <TextInputField
                    containerClassName="w-1/2"
                    value={lastName}
                    label="Last name"
                    error={lastNameError.message}
                    onBlur={lastNameError.onBlur}
                    onChange={setLastName}
                />
            </div>

            <TextInputField
                value={emailAddress}
                label="Email"
                type="email"
                hint="We suggest using your work email"
                error={emailError.message}
                onBlur={emailError.onBlur}
                onChange={setEmailAddress}
            />
        </OnboardingStep>
    );
};

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
