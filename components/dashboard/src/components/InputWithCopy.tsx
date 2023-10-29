/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback } from "react";
import { ReactComponent as CopyIcon } from "../images/copy.svg";
import { ReactComponent as CheckIcon } from "../images/check-currentColor.svg";
import { copyToClipboard } from "../utils";
import { Button } from "./Button";
import { TextInput } from "./forms/TextInputField";
import { useTemporaryState } from "../hooks/use-temporary-value";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@podkit/tooltips/Tooltip";
import { cn } from "@podkit/lib/cn";

type Props = { value: string; tip?: string; className?: string };

export const InputWithCopy: FC<Props> = ({ value, tip = "Click to copy", className }) => {
    const [copied, setCopied] = useTemporaryState(false, 2000);

    const handleCopyToClipboard = useCallback(
        (e) => {
            e.preventDefault();

            copyToClipboard(value);
            setCopied(true);
        },
        [setCopied, value],
    );

    return (
        // max-w-lg is to mirror width of TextInput so Tooltip is positioned correctly
        <div className={`w-full relative max-w-lg ${className ?? ""}`}>
            <TextInput value={value} disabled className="w-full pr-8 overscoll-none" />
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger
                        className={cn("p-0 mx-1 bg-transparent text-black dark:text-white", className)}
                        asChild
                    >
                        <Button
                            type="transparent"
                            htmlType="button"
                            spacing="compact"
                            icon={
                                copied ? (
                                    <CheckIcon className="text-green-500 w-5 h-5" />
                                ) : (
                                    <CopyIcon className="w-3.5 h-3.5" />
                                )
                            }
                            onClick={handleCopyToClipboard}
                        />
                    </TooltipTrigger>
                    <TooltipContent>{copied ? "Copied!" : tip}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
};
