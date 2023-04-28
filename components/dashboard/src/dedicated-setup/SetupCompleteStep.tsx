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
    return (
        <SetupLayout>
            <Heading1>Welcome to Gitpod</Heading1>
            <Subheading>Your teammates can now sign in to Gitpod using single sign-on (SSO).</Subheading>

            <p>placeholder step...</p>

            <div className="mt-6">
                <Button size="block" onClick={onComplete} disabled>
                    Add a Git Integration
                </Button>
            </div>
        </SetupLayout>
    );
};
