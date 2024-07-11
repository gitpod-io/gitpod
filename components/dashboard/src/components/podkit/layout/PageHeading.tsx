/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Heading1, Subheading } from "@podkit/typography/Headings";
import { FC, ReactNode } from "react";

type PageHeadingProps = {
    title: ReactNode;
    subtitle?: ReactNode;
};
export const PageHeading: FC<PageHeadingProps> = ({ title, subtitle }) => {
    return (
        <div className="flex flex-row flex-wrap justify-between py-5 gap-2">
            <div>
                <Heading1>{title}</Heading1>
                {subtitle && <Subheading>{subtitle}</Subheading>}
            </div>
        </div>
    );
};
