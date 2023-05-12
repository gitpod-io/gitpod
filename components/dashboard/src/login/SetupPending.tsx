/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { Heading2, Subheading } from "../components/typography/headings";
import cubicleImg from "../images/cubicle.png";
import cubicleImg2x from "../images/cubicle@2x.png";

export const SetupPending: FC = () => {
    return (
        <div className="flex-grow flex items-center justify-center p-4">
            <div className="max-w-md flex flex-col items-center justify-center text-center">
                <img
                    className="mb-8"
                    src={cubicleImg}
                    srcSet={`${cubicleImg} 1x, ${cubicleImg2x} 2x`}
                    alt="cubical illustration"
                    width="240"
                    height="251"
                />
                <Heading2>Setup is pending</Heading2>
                <Subheading>This instance of Gitpod is not quite ready.</Subheading>
                <Subheading> An administrator has a few additional steps to complete.</Subheading>
            </div>
        </div>
    );
};
