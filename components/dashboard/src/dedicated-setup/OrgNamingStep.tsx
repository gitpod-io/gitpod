/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import { SetupLayout } from "./SetupLayout";
import { Heading1, Subheading } from "../components/typography/headings";
import { TextInputField } from "../components/forms/TextInputField";
import { useOnBlurError } from "../hooks/use-onblur-error";
import { useCreateOrgMutation } from "../data/organizations/create-org-mutation";
import Alert from "../components/Alert";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { useUpdateOrgMutation } from "../data/organizations/update-org-mutation";
import { LoadingButton } from "@podkit/buttons/LoadingButton";

type Props = {
    onComplete: () => void;
    progressCurrent?: number;
    progressTotal?: number;
};
export const OrgNamingStep: FC<Props> = ({ onComplete, progressCurrent, progressTotal }) => {
    const org = useCurrentOrg();
    const [orgName, setOrgName] = useState(org.data?.name ?? "");
    const createOrg = useCreateOrgMutation();
    const updateOrg = useUpdateOrgMutation();

    const handleContinue = useCallback(
        (e) => {
            e.preventDefault();

            if (org.data) {
                updateOrg.mutate({ name: orgName }, { onSuccess: onComplete });
            } else {
                createOrg.mutate(
                    { name: orgName },
                    {
                        onSuccess: (newOrg) => {
                            // Need to manually set active-org here so it's returned via subsequent useCurrentOrg() calls
                            localStorage.setItem("active-org", newOrg.id);
                            onComplete();
                        },
                    },
                );
            }
        },
        [createOrg, onComplete, org.data, orgName, updateOrg],
    );

    const nameError = useOnBlurError("Please provide a name", orgName.trim().length > 0);

    return (
        <SetupLayout progressCurrent={progressCurrent} progressTotal={progressTotal}>
            <div className="mb-10">
                <Heading1>Name your organization</Heading1>
                <Subheading>
                    Your Gitpod organization allows you to manage settings, projects and collaborate with teammates.
                </Subheading>
            </div>
            {(createOrg.isError || updateOrg.isError) && (
                <Alert type="danger">{createOrg.error?.message || updateOrg.error?.message}</Alert>
            )}
            <form onSubmit={handleContinue}>
                <TextInputField
                    label="Organization Name"
                    placeholder="e.g. ACME Inc"
                    hint="The name of your company or organization."
                    value={orgName}
                    error={nameError.message}
                    onChange={setOrgName}
                    onBlur={nameError.onBlur}
                />
                <div className="mt-6">
                    <LoadingButton
                        type="submit"
                        size="full-width"
                        disabled={!nameError.isValid}
                        loading={createOrg.isLoading || updateOrg.isLoading}
                    >
                        Continue
                    </LoadingButton>
                </div>
            </form>
        </SetupLayout>
    );
};
