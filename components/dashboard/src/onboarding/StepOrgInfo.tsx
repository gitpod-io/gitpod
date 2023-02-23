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
import { getExplorationReasons } from "./exploration-reasons";
import { getJobRoleOptions, JOB_ROLE_OTHER } from "./job-roles";
import { OnboardingStep } from "./OnboardingStep";
import { getSignupGoalsOptions, SIGNUP_GOALS_OTHER } from "./signup-goals";
import isURL from "validator/lib/isURL";

type Props = {
    user: User;
    onComplete(user: User): void;
};
export const StepOrgInfo: FC<Props> = ({ user, onComplete }) => {
    const updateUser = useUpdateCurrentUserMutation();
    const jobRoleOptions = useMemo(getJobRoleOptions, []);
    const explorationReasonsOptions = useMemo(getExplorationReasons, []);
    const signupGoalsOptions = useMemo(getSignupGoalsOptions, []);

    const [jobRole, setJobRole] = useState(user.additionalData?.profile?.jobRole ?? "");
    const [jobRoleOther, setJobRoleOther] = useState(user.additionalData?.profile?.jobRoleOther ?? "");
    const [explorationReasons, setExplorationReasons] = useState<string[]>(
        user.additionalData?.profile?.explorationReasons ?? [],
    );
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

    const addExplorationReason = useCallback(
        (reason: string) => {
            if (!explorationReasons.includes(reason)) {
                setExplorationReasons([...explorationReasons, reason]);
            }
        },
        [explorationReasons],
    );

    const removeExplorationReason = useCallback(
        (reason: string) => {
            if (explorationReasons.includes(reason)) {
                const idx = explorationReasons.indexOf(reason);
                const newReasons = [...explorationReasons];
                newReasons.splice(idx, 1);
                setExplorationReasons(newReasons);
            }
        },
        [explorationReasons],
    );

    const handleSubmit = useCallback(async () => {
        const additionalData = user.additionalData || {};
        const profile = additionalData.profile || {};

        // Filter out any values not present in options
        const filteredReasons = explorationReasons.filter((val) =>
            explorationReasonsOptions.find((o) => o.value === val),
        );
        const filteredGoals = signupGoals.filter((val) => signupGoalsOptions.find((o) => o.value === val));

        const updates = {
            additionalData: {
                ...additionalData,
                profile: {
                    ...profile,
                    jobRole,
                    jobRoleOther,
                    explorationReasons: filteredReasons,
                    signupGoals: filteredGoals,
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
        explorationReasons,
        explorationReasonsOptions,
        jobRole,
        jobRoleOther,
        onComplete,
        signupGoals,
        signupGoalsOptions,
        signupGoalsOther,
        updateUser,
        user.additionalData,
    ]);

    const jobRoleError = useOnBlurError("Please select one", !!jobRole);
    const websiteError = useOnBlurError("Please enter a valid url", !companyWebsite || isURL(companyWebsite));
    const isValid =
        jobRoleError.isValid && websiteError.isValid && signupGoals.length > 0 && explorationReasons.length > 0;

    return (
        <OnboardingStep
            title="Tell us more about you"
            subtitle="Let us know what brought you here."
            error={updateUser.isError ? "There was a problem saving your answers" : ""}
            isValid={isValid}
            isSaving={updateUser.isLoading}
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
                placeholder="example.com"
                error={websiteError.message}
                onChange={setCompanyWebsite}
                onBlur={websiteError.onBlur}
            />

            <InputField label="I'm exploring Gitpod..." />
            <div className="mt-4 ml-2 space-y-2">
                {explorationReasonsOptions.map((o) => (
                    <div key={o.value} className="flex space-x-2 justify-start items-center">
                        <input
                            type="checkbox"
                            className="rounded"
                            value={o.value}
                            id={`explore_${o.value}`}
                            checked={explorationReasons.includes(o.value)}
                            onChange={(e) => {
                                if (e.target.checked) {
                                    addExplorationReason(o.value);
                                } else {
                                    removeExplorationReason(o.value);
                                }
                            }}
                        />
                        <label className="text-sm dark:text-gray-400 text-gray-600" htmlFor={`explore_${o.value}`}>
                            {o.label}
                        </label>
                    </div>
                ))}
            </div>

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
