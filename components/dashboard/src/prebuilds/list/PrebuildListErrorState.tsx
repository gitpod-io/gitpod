/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { Heading2, Subheading } from "@podkit/typography/Headings";
import { cn } from "@podkit/lib/cn";

type Props = {
    error: unknown;
};
export const PrebuildListErrorState: FC<Props> = ({ error }: Props) => {
    return (
        <div className={cn("w-full flex justify-center mt-2 rounded-xl bg-pk-surface-secondary px-4 py-20")}>
            <div className="flex flex-col justify-center items-center text-center space-y-4">
                <Heading2>Prebuilds failed to load</Heading2>
                <Subheading className="max-w-md">Error: {error}.</Subheading>
            </div>
        </div>
    );
};
