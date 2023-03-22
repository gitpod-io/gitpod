/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent } from "react";
import { Delayed } from "../components/Delayed";
import { Heading3, Subheading } from "../components/typography/headings";
import gitpodIcon from "../icons/gitpod.svg";

export const AppLoading: FunctionComponent = () => {
    return (
        // Wait 3 seconds before showing the loading screen to avoid flashing it too quickly
        <Delayed wait={3000}>
            <div className="flex flex-col justify-center items-center w-full h-screen space-y-4">
                <img src={gitpodIcon} alt="Gitpod's logo" className={"h-16 flex-shrink-0 animate-bounce"} />
                <Heading3>Just getting a few more things ready</Heading3>
                <Subheading>hang in there...</Subheading>
            </div>
        </Delayed>
    );
};
