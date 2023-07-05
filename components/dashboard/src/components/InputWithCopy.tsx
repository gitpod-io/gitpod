/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback } from "react";
import Tooltip from "../components/Tooltip";
import { ReactComponent as CopyIcon } from "../images/copy.svg";
import { ReactComponent as CheckIcon } from "../images/check-currentColor.svg";
import { copyToClipboard } from "../utils";
import { Button } from "./Button";
import { TextInput } from "./forms/TextInputField";
import { useTemporaryState } from "../hooks/use-temporary-value";

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

            <Tooltip content={tip} className="absolute top-1.5 right-1">
                <Button
                    type="transparent"
                    htmlType="button"
                    spacing="compact"
                    icon={
                        copied ? <CheckIcon className="text-green-500 w-5 h-5" /> : <CopyIcon className="w-3.5 h-3.5" />
                    }
                    onClick={handleCopyToClipboard}
                />
            </Tooltip>
        </div>
    );
};
