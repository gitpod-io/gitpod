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

type Props = {
    onComplete: () => void;
};
export const OrgNamingStep: FC<Props> = ({ onComplete }) => {
    // TODO: if there's already an org create, set initial value to current org
    const [orgName, setOrgName] = useState("");
    const createOrg = useCreateOrgMutation();

    const handleContinue = useCallback(async () => {
        createOrg.mutate({ name: orgName }, { onSuccess: () => onComplete() });
    }, [createOrg, onComplete, orgName]);

    const nameError = useOnBlurError("Please provide a name", orgName.trim().length > 0);

    return (
        <SetupLayout>
            <div className="mb-10">
                <Heading1>Name your organization</Heading1>
                <Subheading>
                    Your Gitpod organization allows you to manage settings, projects and collaborate with teammates.
                </Subheading>
            </div>

            {createOrg.isError && <Alert type="danger">{createOrg.error.message}</Alert>}

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
                    loading={createOrg.isLoading}
                >
                    Continue
                </Button>
            </div>
        </SetupLayout>
    );
};
