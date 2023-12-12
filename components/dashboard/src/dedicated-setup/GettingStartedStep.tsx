/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { Button } from "@podkit/buttons/Button";
import { Heading1, Subheading } from "../components/typography/headings";
import { SetupLayout } from "./SetupLayout";

type Props = {
    onComplete: () => void;
    progressCurrent?: number;
    progressTotal?: number;
};
export const GettingStartedStep: FC<Props> = ({ onComplete, progressCurrent, progressTotal }) => {
    return (
        <SetupLayout progressCurrent={progressCurrent} progressTotal={progressTotal}>
            <Heading1>Let's get started</Heading1>
            <Subheading>
                Spin up fresh cloud development environments for each task, fully automated, in seconds.
            </Subheading>

            <div className="mt-6">
                <Button size="full-width" onClick={onComplete}>
                    Get Started
                </Button>
            </div>
        </SetupLayout>
    );
};
