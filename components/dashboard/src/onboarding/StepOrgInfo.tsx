/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { FC, useCallback, useMemo, useState } from "react";
import { CheckboxInputField, CheckboxListField } from "../components/forms/CheckboxInputField";
import { SelectInputField } from "../components/forms/SelectInputField";
import { TextInputField } from "../components/forms/TextInputField";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";
import { useOnBlurError } from "../hooks/use-onblur-error";
import { EXPLORE_REASON_WORK, getExplorationReasons } from "./exploration-reasons";
import { getJobRoleOptions, JOB_ROLE_OTHER } from "./job-roles";
import { OnboardingStep } from "./OnboardingStep";
import { getSignupGoalsOptions, SIGNUP_GOALS_OTHER } from "./signup-goals";
import { getCompanySizeOptions } from "./company-size";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { useCreateOrgMutation } from "../data/organizations/create-org-mutation";

type Props = {
    user: User;
    onComplete(user: User): void;
};
export const StepOrgInfo: FC<Props> = ({ user, onComplete }) => {
    const updateUser = useUpdateCurrentUserMutation();
    const jobRoleOptions = useMemo(getJobRoleOptions, []);
    const explorationReasonsOptions = useMemo(getExplorationReasons, []);
    const signupGoalsOptions = useMemo(getSignupGoalsOptions, []);
    const companySizeOptions = useMemo(getCompanySizeOptions, []);
    const currentOrg = useCurrentOrg();
    const createOrg = useCreateOrgMutation();

    const [jobRole, setJobRole] = useState(user.additionalData?.profile?.jobRole ?? "");
    const [jobRoleOther, setJobRoleOther] = useState(user.additionalData?.profile?.jobRoleOther ?? "");
    const [explorationReasons, setExplorationReasons] = useState<string[]>(
        user.additionalData?.profile?.explorationReasons ?? [],
    );
    const [signupGoals, setSignupGoals] = useState<string[]>(user.additionalData?.profile?.signupGoals ?? []);
    const [signupGoalsOther, setSignupGoalsOther] = useState(user.additionalData?.profile?.signupGoalsOther ?? "");
    const [companySize, setCompanySize] = useState(user.additionalData?.profile?.companySize ?? "");

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
            if (reason === EXPLORE_REASON_WORK) {
                setCompanySize("");
            }
        },
        [explorationReasons],
    );

    const handleSubmit = useCallback(async () => {
        // create an org if the user is not a member of one already
        if (!currentOrg.data) {
            let orgName = "My Org";
            function orgify(name: string) {
                const result = name.split(" ")[0];
                if (result.endsWith("s")) {
                    return `${result}' Org`;
                }
                return `${result}'s Org`;
            }
            if (user.name) {
                orgName = orgify(user.name);
            }
            if (user.fullName) {
                orgName = orgify(user.fullName);
            }
            await createOrg.mutateAsync({
                name: orgName,
            });
        }

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
                    companySize,
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
        companySize,
        createOrg,
        currentOrg.data,
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
        user.fullName,
        user.name,
    ]);

    const jobRoleError = useOnBlurError("Please select one", !!jobRole);
    const companySizeError = useOnBlurError(
        "Please select one",
        !explorationReasons.includes(EXPLORE_REASON_WORK) || !!companySize,
    );
    const isValid =
        jobRoleError.isValid && companySizeError.isValid && signupGoals.length > 0 && explorationReasons.length > 0;

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
                <TextInputField value={jobRoleOther} onChange={setJobRoleOther} placeholder="Please share (optional)" />
            )}

            <CheckboxListField label="I'm exploring Gitpod...">
                {explorationReasonsOptions.map((o) => (
                    <CheckboxInputField
                        key={o.value}
                        value={o.value}
                        label={o.label}
                        checked={explorationReasons.includes(o.value)}
                        topMargin={false}
                        onChange={(checked) => {
                            if (checked) {
                                addExplorationReason(o.value);
                            } else {
                                removeExplorationReason(o.value);
                            }
                        }}
                    />
                ))}
            </CheckboxListField>

            {explorationReasons.includes(EXPLORE_REASON_WORK) && (
                <SelectInputField
                    value={companySize}
                    label="How large is your engineering organization?"
                    onChange={setCompanySize}
                    error={companySizeError.message}
                    onBlur={companySizeError.onBlur}
                >
                    {companySizeOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </SelectInputField>
            )}

            <CheckboxListField label="I'm signing up for Gitpod for...">
                {signupGoalsOptions.map((o) => (
                    <CheckboxInputField
                        key={o.value}
                        value={o.value}
                        label={o.label}
                        checked={signupGoals.includes(o.value)}
                        topMargin={false}
                        onChange={(checked) => {
                            if (checked) {
                                addSignupGoal(o.value);
                            } else {
                                removeSignupGoal(o.value);
                            }
                        }}
                    />
                ))}
            </CheckboxListField>

            {signupGoals.includes(SIGNUP_GOALS_OTHER) && (
                <TextInputField
                    value={signupGoalsOther}
                    placeholder="Please share (optional)"
                    onChange={setSignupGoalsOther}
                />
            )}
        </OnboardingStep>
    );
};
