/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FormEvent, FunctionComponent, useCallback, useMemo, useState } from "react";
import { InputField } from "../components/forms/InputField";
import { SelectInputField } from "../components/forms/SelectInputField";
import { TextInputField } from "../components/forms/TextInputField";
import SelectIDEComponent from "../components/SelectIDEComponent";
import { useOnBlurError } from "../hooks/use-onblur-error";

export type OnboardingProfileDetails = {
    firstName: string;
    lastName: string;
    emailAddress: string;
    companyWebsite: string;
    jobRole: string;
    jobRoleOther: string;
    signupGoals: string[];
    signupGoalsOther: string;
};

type Props = {
    profile: OnboardingProfileDetails;
    onUpdate: (change: Partial<OnboardingProfileDetails>) => void;
    onSubmit: () => void;
};
export const OnboardingForm: FunctionComponent<Props> = ({ profile, onUpdate, onSubmit }) => {
    const jobRoleOptions = useMemo(getJobRoleOptions, []);
    const signupGoalsOptions = useMemo(getSignupGoalsOptions, []);

    const [ide, setIDE] = useState("");
    const [useLatest, setUseLatest] = useState(false);

    const handleSubmit = useCallback(
        (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();

            onSubmit();
        },
        [onSubmit],
    );

    const firstNameError = useOnBlurError("Please enter a value", !!profile.firstName);
    const lastNameError = useOnBlurError("Please enter a value", !!profile.lastName);
    const emailError = useOnBlurError("Please enter a value", !!profile.emailAddress);
    const jobRoleError = useOnBlurError("Please select one", !!profile.jobRole);
    const jobRoleOtherError = useOnBlurError(
        "Please provide a description",
        (profile.jobRole === "other" && !!profile.jobRoleOther) || profile.jobRole !== "other",
    );

    return (
        <form onSubmit={handleSubmit}>
            <div className="flex justify-between space-x-2 w-full max-w-lg">
                <TextInputField
                    containerClassName="w-1/2"
                    value={profile.firstName}
                    label="First name"
                    error={firstNameError.message}
                    onBlur={firstNameError.onBlur}
                    onChange={(val) => onUpdate({ firstName: val })}
                />

                <TextInputField
                    containerClassName="w-1/2"
                    value={profile.lastName}
                    label="Last name"
                    error={lastNameError.message}
                    onBlur={lastNameError.onBlur}
                    onChange={(val) => onUpdate({ lastName: val })}
                />
            </div>

            <TextInputField
                value={profile.emailAddress}
                label="Email"
                type="email"
                hint="We suggest using your work email"
                error={emailError.message}
                onBlur={emailError.onBlur}
                onChange={(val) => onUpdate({ emailAddress: val })}
            />

            <SelectInputField
                value={profile.jobRole}
                label="I work in..."
                onChange={(val) => onUpdate({ jobRole: val })}
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
            {profile.jobRole === "other" && (
                <TextInputField
                    value={profile.jobRoleOther}
                    label="Other"
                    error={jobRoleOtherError.message}
                    onBlur={jobRoleOtherError.onBlur}
                    onChange={(val) => onUpdate({ jobRoleOther: val })}
                />
            )}

            <SelectInputField
                label="What do you wish to accomplish with Gitpod?"
                onChange={(val) => onUpdate({ signupGoalsOther: val })}
                hint="Select all that apply"
            >
                {signupGoalsOptions.map((o) => (
                    <option key={o.value} value={o.value} selected={profile.signupGoals?.includes(o.value) ?? false}>
                        {o.label}
                    </option>
                ))}
            </SelectInputField>
            {profile.signupGoals.includes("other") && (
                <TextInputField
                    value={profile.signupGoalsOther}
                    label="Other"
                    onChange={(val) => onUpdate({ signupGoalsOther: val })}
                />
            )}

            <TextInputField
                value={profile.companyWebsite}
                label="Organization Website (optional)"
                type="url"
                onChange={(val) => onUpdate({ companyWebsite: val })}
            />

            <InputField label="Select your preferred IDE" className="w-full max-w-lg">
                <SelectIDEComponent
                    onSelectionChange={(ide, latest) => {
                        setIDE(ide);
                        setUseLatest(latest);
                    }}
                    setError={(e) => console.log("set ide error", e)}
                    selectedIdeOption={ide}
                    useLatest={useLatest}
                />
            </InputField>

            <div className="mt-6 flex justify-end">
                <button>Save</button>
            </div>
        </form>
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
