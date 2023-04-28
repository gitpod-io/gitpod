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

export const OrgNamingStep: FC = () => {
    // TODO: if there's already an org create, set initial value to current org
    const [orgName, setOrgName] = useState("");

    const handleContinue = useCallback(() => {
        console.log("continue", orgName);
    }, [orgName]);

    return (
        <SetupLayout>
            {/* TODO: Push this into SetupLayout? */}
            <div className="mb-10">
                <Heading1>Name your organization</Heading1>
                <Subheading>
                    Your Gitpod organization allows you to manage settings, projects and collaborate with teammates.
                </Subheading>
            </div>

            <TextInputField
                label="Organization Name"
                placeholder="e.g. ACME Inc"
                hint="The name of your company or organization."
                value={orgName}
                onChange={setOrgName}
            />

            <div className="mt-6">
                <Button size="block" onClick={handleContinue}>
                    Continue
                </Button>
            </div>
        </SetupLayout>
    );
};
