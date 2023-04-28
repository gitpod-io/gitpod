/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect } from "react";
import { Button } from "../components/Button";
import { Heading1, Subheading } from "../components/typography/headings";
import { SetupLayout } from "./SetupLayout";

type Props = {
    onComplete?: () => void;
};
const DedicatedSetup: FC<Props> = ({ onComplete }) => {
    const handleGetStarted = useCallback(() => {
        console.log("getting started");
    }, []);

    useEffect(() => {
        document.body.classList.add("honeycomb-bg");

        return () => {
            document.body.classList.remove("honeycomb-bg");
        };
    }, []);

    return (
        <SetupLayout>
            <Heading1>Let's get started</Heading1>
            <Subheading>
                Spin up fresh cloud development environments for each task, fully automated, in seconds.
            </Subheading>

            <div className="mt-6">
                <Button size="block" onClick={handleGetStarted}>
                    Get Started
                </Button>
            </div>
        </SetupLayout>
    );
};

export default DedicatedSetup;
