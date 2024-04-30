/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import Tooltip from "../components/Tooltip";
import { ReactComponent as CopyIcon } from "../images/copy.svg";
import { ReactComponent as CheckIcon } from "../images/check-currentColor.svg";
import { copyToClipboard } from "../utils";
import { Button } from "@podkit/buttons/Button";
import { TextInput } from "./forms/TextInputField";
import { useTemporaryState } from "../hooks/use-temporary-value";
import { cn } from "@podkit/lib/cn";

type Props = { value: string; tip?: string; className?: string };
export const InputWithCopy: FC<Props> = ({ value, tip = "Click to copy", className }) => {
    const [copied, setCopied] = useTemporaryState(false, 2000);
    const [copyError, setCopyError] = useState<string | undefined>();

    const handleCopyToClipboard = useCallback(
        (e) => {
            e.preventDefault();

            copyToClipboard(value)
                .then(() => {
                    setCopied(true);
                })
                .catch((error) => {
                    if (error instanceof DOMException) {
                        setCopyError(
                            "Gitpod is not allowed to copy to clipboard. Please copy the URL manually or adjust your browser permissions.",
                        );
                        return;
                    }

                    setCopyError("Failed to copy to clipboard. Please copy the URL manually.");
                });
        },
        [setCopied, value],
    );

    return (
        <>
            {/* max-w-lg is to mirror width of TextInput so Tooltip is positioned correctly */}
            <div className={cn(`w-full relative max-w-lg`, className)}>
                <TextInput
                    value={value}
                    disabled
                    className="w-full pr-8 overscroll-none bg-pk-surface-tertiary text-pk-content-primary"
                />

                <Tooltip content={tip} className="absolute top-0 right-0">
                    <Button
                        variant="ghost"
                        size={"icon"}
                        onClick={handleCopyToClipboard}
                        type="button"
                        className="ring-inset"
                    >
                        {copied ? <CheckIcon className="text-green-500 w-5 h-5" /> : <CopyIcon className="size-3.5" />}
                    </Button>
                </Tooltip>
            </div>
            {copyError && <p className="text-pk-content-danger mt-1 max-w-lg">{copyError}</p>}
        </>
    );
};
