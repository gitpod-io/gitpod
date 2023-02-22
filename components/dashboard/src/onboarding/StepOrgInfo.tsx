/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { FC, useCallback, useMemo, useState } from "react";
import { SelectInputField } from "../components/forms/SelectInputField";
import { TextInputField } from "../components/forms/TextInputField";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";
import { useOnBlurError } from "../hooks/use-onblur-error";
import { OnboardingStep } from "./OnboardingStep";

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
    const [signupGoals, setSignupGoals] = useState(user.additionalData?.profile?.signupGoals ?? "");
    const [signupGoalsOther, setSignupGoalsOther] = useState(user.additionalData?.profile?.signupGoalsOther ?? "");
    const [companyWebsite, setCompanyWebsite] = useState(user.additionalData?.profile?.companyWebsite ?? "");

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
                    signupGoals,
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
    const jobRoleOtherError = useOnBlurError(
        "Please provide a description",
        (jobRole === "other" && !!jobRoleOther) || jobRole !== "other",
    );
    const goalsError = useOnBlurError("Please select one", !!signupGoals);
    const goalsOtherError = useOnBlurError(
        "Please provide a description",
        (signupGoals === "other" && !!signupGoalsOther) || signupGoals !== "other",
    );

    const isValid = [jobRoleError, jobRoleOtherError, goalsError, goalsOtherError].every((e) => e.isValid);

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
                onChange={setJobRole}
                hint="Please select the role that best describes the type of work you'll use Gitpod for"
                error={jobRoleError.message}
                onBlur={jobRoleError.onBlur}
            >
                {jobRoleOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </SelectInputField>

            {jobRole === "other" && (
                <TextInputField
                    value={jobRoleOther}
                    label="Other"
                    error={jobRoleOtherError.message}
                    onBlur={jobRoleOtherError.onBlur}
                    onChange={setJobRoleOther}
                />
            )}

            <SelectInputField
                label="What do you wish to accomplish with Gitpod?"
                value={signupGoals}
                onChange={setSignupGoals}
                hint="Select all that apply"
                error={goalsError.message}
                onBlur={goalsError.onBlur}
            >
                {signupGoalsOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </SelectInputField>
            {signupGoals === "other" && (
                <TextInputField value={signupGoalsOther} label="Other" onChange={setSignupGoalsOther} />
            )}

            <TextInputField
                value={companyWebsite}
                label="Organization Website (optional)"
                type="url"
                onChange={setCompanyWebsite}
            />
        </OnboardingStep>
    );
};

// TODO: pull values into constants
const getJobRoleOptions = () => {
    return [
        { label: "Please select one", value: "" },
        { label: "Backend", value: "backend" },
        { label: "Frontend", value: "frontend" },
        { label: "Fullstack", value: "fullstack" },
        { label: "Data / analytics", value: "data / analytics" },
        { label: "DevOps / devX / platform", value: "devops / devx / platform" },
        { label: "Product / design", value: "product / design" },
        { label: "Customer engineering", value: "customer engineering" },
        { label: "DevRel", value: "devrel" },
        { label: "Open source", value: "open source" },
        { label: "Academia / student", value: "academia / student" },
        { label: "Other / prefer not to say: please specify", value: "other" },
    ];
};

const getSignupGoalsOptions = () => {
    return [
        { label: "Please select one", value: "" },
        {
            label: "Replace remote/containerized development (VDI, VM based, Docker Desktop..)",
            value: "replace remote/containerized development (vdi, vm based, docker desktop..)",
        },
        { label: "More powerful dev resources", value: "more powerful dev resources" },
        { label: "Just exploring CDEs", value: "just exploring cdes" },
        { label: "Faster onboarding", value: "faster onboarding" },
        { label: "More secure dev process", value: "more secure dev process" },
        { label: "Dev efficiency & collaboration", value: "dev efficiency & collaboration" },
        { label: "Contribute to open source", value: "contribute to open source" },
        { label: "Work from any device (iPad,…)", value: "work from any device (ipad,…)" },
        { label: "Solve “works on my machine issue”", value: "solve “works on my machine issue”" },
        { label: "Work on hobby projects", value: "work on hobby projects" },
        { label: "other / prefer not to say: please specify", value: "other" },
    ];
};
