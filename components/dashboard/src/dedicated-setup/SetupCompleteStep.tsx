/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { Button } from "../components/Button";
import { Heading1, Subheading } from "../components/typography/headings";
import { SetupLayout } from "./SetupLayout";

type Props = {
    onComplete: () => void;
};
export const SetupCompleteStep: FC<Props> = ({ onComplete }) => {
    const url = document.location.origin;

    return (
        <SetupLayout showOrg showUser noMaxWidth>
            <Heading1>Welcome to Gitpod</Heading1>
            <Subheading>Your teammates can now sign in to Gitpod using single sign-on (SSO).</Subheading>

            <div className="mt-4">
                <pre className="font-mono text-sm text-gray-500 dark:text-gray-600">{`> ${url}`}</pre>
            </div>

            <div className="mt-6 max-w-md">
                <Button size="block" onClick={onComplete}>
                    Add a Git Integration
                </Button>
            </div>
        </SetupLayout>
    );
};
