/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Heading1, Subheading } from "@podkit/typography/Headings";
import { FC, ReactNode } from "react";

type PageHeadingProps = {
    title: string;
    subtitle?: string;
    action?: ReactNode;
};
export const PageHeading: FC<PageHeadingProps> = ({ title, subtitle, action }) => {
    return (
        <div className="flex flex-row justify-between py-8">
            <div>
                <Heading1>{title}</Heading1>
                {subtitle && <Subheading>{subtitle}</Subheading>}
            </div>
            {action && action}
        </div>
    );
};
