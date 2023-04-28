/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback } from "react";
import { Button } from "../components/Button";
import { Heading1, Subheading } from "../components/typography/headings";
import { SetupLayout } from "./SetupLayout";

type Props = {
    onComplete: () => void;
};
export const SSOSetupStep: FC<Props> = ({ onComplete }) => {
    const handleVerify = useCallback(() => {
        console.log("verify");

        onComplete();
    }, [onComplete]);

    return (
        <SetupLayout>
            <Heading1>Configure single sign-on</Heading1>
            <Subheading>
                {/* TODO: Find what link we want to use here */}
                Enable single sign-on for your organization using the OpenID Connect (OIDC) standard.{" "}
                <a href="https://gitpod.io">Learn more</a>
            </Subheading>

            <p>placeholder step...</p>

            <div className="mt-6">
                <Button size="block" onClick={handleVerify} disabled>
                    Verify SSO Configuration
                </Button>
            </div>
        </SetupLayout>
    );
};
