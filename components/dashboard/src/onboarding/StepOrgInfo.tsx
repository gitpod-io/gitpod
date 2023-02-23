/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { FC, useCallback, useMemo, useState } from "react";
import { InputField } from "../components/forms/InputField";
import { SelectInputField } from "../components/forms/SelectInputField";
import { TextInputField } from "../components/forms/TextInputField";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";
import { useOnBlurError } from "../hooks/use-onblur-error";
import { getJobRoleOptions, JOB_ROLE_OTHER } from "./job-roles";
import { OnboardingStep } from "./OnboardingStep";
import { getSignupGoalsOptions, SIGNUP_GOALS_OTHER } from "./signup-goals";

type Props = {
    user: User;
    onComplete(user: User): void;
};
export const StepOrgInfo: FC<Props> = ({ user, onComplete }) => {
    const updateUser = useUpdateCurrentUserMutation();
    const jobRoleOptions = useMemo(getJobRoleOptions, []);
    const signupGoalsOptions = useMemo(getSignupGoalsOptions, []);

    const [jobRole, setJobRole] = useState(user.additionalData?.profile?.jobRole ?? "");
    const [jobRoleOther, setJobRoleOther] = useState(user.additionalData?.profile?.jobRoleOther ?? "");
    const [signupGoals, setSignupGoals] = useState<string[]>(user.additionalData?.profile?.signupGoals ?? []);
    const [signupGoalsOther, setSignupGoalsOther] = useState(user.additionalData?.profile?.signupGoalsOther ?? "");
    const [companyWebsite, setCompanyWebsite] = useState(user.additionalData?.profile?.companyWebsite ?? "");

    const addSignupGoal = useCallback(
        (goal: string) => {
            if (!signupGoals.includes(goal)) {
                setSignupGoals([...signupGoals, goal]);
            }
        },
        [signupGoals],
    );

    const removeSignupGoal = useCallback(
        (goal: string) => {
            if (signupGoals.includes(goal)) {
                const idx = signupGoals.indexOf(goal);
                const newGoals = [...signupGoals];
                newGoals.splice(idx, 1);
                setSignupGoals(newGoals);
            }
            // clear out freeform other if removing option
            if (goal === SIGNUP_GOALS_OTHER) {
                setSignupGoalsOther("");
            }
        },
        [signupGoals],
    );

    const handleSubmit = useCallback(async () => {
        const additionalData = user.additionalData || {};
        const profile = additionalData.profile || {};

        const updates = {
            additionalData: {
                ...additionalData,
                profile: {
                    ...profile,
                    jobRole,
                    jobRoleOther,
                    signupGoals: signupGoals.filter(Boolean),
                    signupGoalsOther,
                    companyWebsite,
                },
            },
        };

        try {
            const updatedUser = await updateUser.mutateAsync(updates);
            onComplete(updatedUser);
        } catch (e) {
            console.error(e);
        }
    }, [
        companyWebsite,
        jobRole,
        jobRoleOther,
        onComplete,
        signupGoals,
        signupGoalsOther,
        updateUser,
        user.additionalData,
    ]);

    const jobRoleError = useOnBlurError("Please select one", !!jobRole);
    const isValid = jobRoleError.isValid && signupGoals.length > 0;

    return (
        <OnboardingStep
            title="Tell us more about you"
            subtitle="Let us know what brought you here."
            error={updateUser.isError ? "There was a problem saving your answers" : ""}
            isValid={isValid}
            isLoading={updateUser.isLoading}
            onSubmit={handleSubmit}
        >
            <SelectInputField
                value={jobRole}
                label="I work in..."
                onChange={(val) => {
                    if (val !== "other") {
                        setJobRoleOther("");
                    }
                    setJobRole(val);
                }}
                hint={
                    jobRole !== JOB_ROLE_OTHER
                        ? "Please select the role that best describes the type of work you'll use Gitpod for"
                        : ""
                }
                error={jobRoleError.message}
                onBlur={jobRoleError.onBlur}
            >
                {jobRoleOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </SelectInputField>

            {jobRole === JOB_ROLE_OTHER && (
                <TextInputField
                    value={jobRoleOther}
                    onChange={setJobRoleOther}
                    placeholder="Please specify"
                    hint={
                        jobRole === JOB_ROLE_OTHER
                            ? "Please select the role that best describes the type of work you'll use Gitpod for"
                            : ""
                    }
                />
            )}

            <TextInputField
                value={companyWebsite}
                label="Company Website (optional)"
                type="url"
                placeholder="https://"
                onChange={setCompanyWebsite}
            />

            <InputField label="I'm signing up for Gitpod to..." />
            <div className="mt-4 ml-2 space-y-2">
                {signupGoalsOptions.map((o) => (
                    <div key={o.value} className="flex space-x-2 justify-start items-center">
                        <input
                            type="checkbox"
                            className="rounded"
                            value={o.value}
                            id={`goals_${o.value}`}
                            checked={signupGoals.includes(o.value)}
                            onChange={(e) => {
                                if (e.target.checked) {
                                    addSignupGoal(o.value);
                                } else {
                                    removeSignupGoal(o.value);
                                }
                            }}
                        />
                        <label className="text-sm dark:text-gray-400 text-gray-600" htmlFor={`goals_${o.value}`}>
                            {o.label}
                        </label>
                    </div>
                ))}
            </div>

            {signupGoals.includes(SIGNUP_GOALS_OTHER) && (
                <TextInputField value={signupGoalsOther} placeholder="Please specify" onChange={setSignupGoalsOther} />
            )}
        </OnboardingStep>
    );
};
