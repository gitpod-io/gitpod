/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { Heading2, Subheading } from "../components/typography/headings";
import cubicleImg from "../images/cubicle.png";
import cubicleImg2x from "../images/cubicle-2x.png";
import gitpodIcon from "../icons/gitpod.svg";
import classNames from "classnames";

type Props = {
    alwaysShowHeader: boolean;
};
export const SetupPending: FC<Props> = ({ alwaysShowHeader }) => {
    return (
        <div className="flex-grow flex items-center justify-center p-4">
            <div className={classNames(alwaysShowHeader ? "" : "lg:hidden", "absolute top-0 left-0 right-0")}>
                <div className="flex items-center justify-center items-center py-3 space-x-1">
                    <img src={gitpodIcon} className="w-6 h-6" alt="Gitpod's logo" />
                    <span className="text-lg">Gitpod</span>
                </div>
            </div>
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
