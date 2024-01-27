/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { Heading2, Subheading } from "../components/typography/headings";
import cubicleImg from "../images/cubicle.webp";
import cubicleDarkImg from "../images/cubicle-dark.webp";
import cubicleImg2x from "../images/cubicle@2x.webp";
import cubicleDarkImg2x from "../images/cubicle-dark@2x.webp";
import gitpodIcon from "../images/gitpod.svg";
import gitpodDarkIcon from "../images/gitpod-dark.svg";
import classNames from "classnames";
import { useTheme } from "../theme-context";

type Props = {
    alwaysShowHeader: boolean;
};
export const SetupPending: FC<Props> = ({ alwaysShowHeader }) => {
    const { isDark } = useTheme();

    return (
        <div className="flex-grow flex items-center justify-center p-4">
            <div className={classNames(alwaysShowHeader ? "" : "lg:hidden", "absolute top-0 left-0 right-0")}>
                <div className="flex items-center justify-center items-center py-3 space-x-1">
                    <img src={isDark ? gitpodDarkIcon : gitpodIcon} className="h-8" alt="Gitpod's logo" />
                </div>
            </div>
            <div className="max-w-md flex flex-col items-center justify-center text-center">
                <img
                    className="mb-8"
                    src={isDark ? cubicleDarkImg : cubicleImg}
                    srcSet={`${isDark ? cubicleDarkImg : cubicleImg} 1x, ${
                        isDark ? cubicleDarkImg2x : cubicleImg2x
                    } 2x`}
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
