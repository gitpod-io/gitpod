/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import { SetupLayout } from "./SetupLayout";
import { Heading1, Subheading } from "../components/typography/headings";
import { TextInputField } from "../components/forms/TextInputField";
import { Button } from "../components/Button";
import { useOnBlurError } from "../hooks/use-onblur-error";
import { useCreateOrgMutation } from "../data/organizations/create-org-mutation";
import Alert from "../components/Alert";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { useUpdateOrgMutation } from "../data/organizations/update-org-mutation";

type Props = {
    onComplete: () => void;
};
export const OrgNamingStep: FC<Props> = ({ onComplete }) => {
    const org = useCurrentOrg();
    const [orgName, setOrgName] = useState(org.data?.name ?? "");
    const createOrg = useCreateOrgMutation();
    const updateOrg = useUpdateOrgMutation();

    const handleContinue = useCallback(() => {
        if (org.data) {
            updateOrg.mutate({ name: orgName }, { onSuccess: onComplete });
        } else {
            createOrg.mutate({ name: orgName }, { onSuccess: onComplete });
        }
    }, [createOrg, onComplete, org.data, orgName, updateOrg]);

    const nameError = useOnBlurError("Please provide a name", orgName.trim().length > 0);

    return (
        <SetupLayout>
            {/* TODO: extract this into SetupLayout and accept props to control progress indicator */}
            <div className="flex flex-row space-x-2 mb-4">
                <div className="w-5 h-5 bg-gray-400 rounded-full" />
                <div className="w-5 h-5 border-2 border-dashed rounded-full border-gray-400" />
            </div>
            <div className="mb-10">
                <Heading1>Name your organization</Heading1>
                <Subheading>
                    Your Gitpod organization allows you to manage settings, projects and collaborate with teammates.
                </Subheading>
            </div>
            {(createOrg.isError || updateOrg.isError) && (
                <Alert type="danger">{createOrg.error?.message || updateOrg.error?.message}</Alert>
            )}
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
                <Button
                    size="block"
                    onClick={handleContinue}
                    disabled={!nameError.isValid}
                    loading={createOrg.isLoading || updateOrg.isLoading}
                >
                    Continue
                </Button>
            </div>
        </SetupLayout>
    );
};
