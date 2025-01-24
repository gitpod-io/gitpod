/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Heading2, Subheading } from "@podkit/typography/Headings";
import { cn } from "@podkit/lib/cn";
import { Button } from "@podkit/buttons/Button";

type Props = {
    onTriggerPrebuild: () => void;
};
export const PrebuildListEmptyState = ({ onTriggerPrebuild }: Props) => {
    return (
        <div className={cn("w-full flex justify-center mt-2 rounded-xl bg-pk-surface-secondary px-4 py-20")}>
            <div className="flex flex-col justify-center items-center text-center space-y-4">
                <Heading2>No prebuilds yet</Heading2>
                <Subheading className="max-w-md flex flex-col items-center gap-4">
                    Go on, import some repositories and turn prebuilds on.
                    <Button onClick={onTriggerPrebuild} className="w-32">
                        Run prebuild
                    </Button>
                </Subheading>
            </div>
        </div>
    );
};
