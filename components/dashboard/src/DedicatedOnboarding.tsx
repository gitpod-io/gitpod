/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback } from "react";
import { Button } from "./components/Button";
import { Heading1, Subheading } from "./components/typography/headings";

type Props = {
    onComplete?: () => void;
};
export default function DedicatedOnboarding({ onComplete }: Props) {
    const handleGetStarted = useCallback(() => {
        console.log("getting started");
    }, []);

    return (
        <div>
            <Heading1>Let's get started</Heading1>
            {/* TODO: verify this is the copy we want to use */}
            <Subheading>
                Spin up fresh cloud development environments for each task, full automated, in seconds.
            </Subheading>
            <Button onClick={handleGetStarted}>Get Started</Button>
        </div>
    );
}
