/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect } from "react";
import { Button } from "../components/Button";
import gitpodIcon from "../icons/gitpod.svg";
import { Heading1, Subheading } from "../components/typography/headings";
import "./styles.css";

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
        <div className="container">
            <div className="app-container">
                <div className="flex items-center justify-start items-center py-3 space-x-1">
                    <img src={gitpodIcon} className="h-6" alt="Gitpod's logo" />
                    <span className="text-lg">Gitpod</span>
                </div>
                <div className="mt-24 max-w-sm">
                    <Heading1>Let's get started</Heading1>
                    {/* TODO: verify this is the copy we want to use */}
                    <Subheading>
                        Spin up fresh cloud development environments for each task, full automated, in seconds.
                    </Subheading>

                    <div className="mt-6">
                        <Button size="block" onClick={handleGetStarted}>
                            Get Started
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DedicatedSetup;
