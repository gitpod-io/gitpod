/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { Heading2, Subheading } from "@podkit/typography/Headings";
import { Button } from "@podkit/buttons/Button";
import { cn } from "@podkit/lib/cn";

type Props = {
    onImport: () => void;
};
export const RepoListEmptyState: FC<Props> = ({ onImport }) => {
    return (
        <div className={cn("w-full flex justify-center mt-2 rounded-xl bg-pk-surface-secondary px-4 py-20")}>
            <div className="flex flex-col justify-center items-center text-center space-y-4">
                <Heading2>No added repositories yet</Heading2>
                <Subheading className="max-w-md">
                    Configuring repositories allows your team members to be coding at the click of a button.
                </Subheading>
                <Button onClick={onImport}>Add a Repository</Button>
            </div>
        </div>
    );
};
