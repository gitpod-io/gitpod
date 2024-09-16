/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Heading2 } from "@podkit/typography/Headings";
import { TextMuted } from "@podkit/typography/TextMuted";
import { useTheme } from "../theme-context";

import cubicleImg from "../images/cubicle.webp";
import cubicleDarkImg from "../images/cubicle-dark.webp";
import cubicleImg2x from "../images/cubicle@2x.webp";
import cubicleDarkImg2x from "../images/cubicle-dark@2x.webp";

export const DisabledCell = () => {
    const { isDark } = useTheme();

    return (
        <div className="p-0 h-[100dvh] flex flex-col items-center justify-center">
            <section className="flex flex-col justify-center items-center text-center">
                <img
                    src={isDark ? cubicleDarkImg : cubicleImg}
                    srcSet={`${isDark ? cubicleDarkImg : cubicleImg} 1x, ${
                        isDark ? cubicleDarkImg2x : cubicleImg2x
                    } 2x`}
                    alt="cubical illustration"
                    width="240"
                    height="251"
                />
                <Heading2 className="my-4">Thank you for evaluating Gitpod</Heading2>
                <TextMuted>
                    This evaluation instance is now stopped. <br />
                    Please contact our team to move to next steps.
                </TextMuted>
            </section>
        </div>
    );
};
