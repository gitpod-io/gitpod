/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useState } from "react";
import Tooltip from "../components/Tooltip";
import copy from "../images/copy.svg";
import { copyToClipboard } from "../utils";

export function InputWithCopy(props: { value: string; tip?: string; className?: string }) {
    const [copied, setCopied] = useState<boolean>(false);
    const handleCopyToClipboard = (text: string) => {
        copyToClipboard(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const tip = props.tip ?? "Click to copy";
    return (
        <div className={`w-full relative ${props.className ?? ""}`}>
            <input
                disabled={true}
                readOnly={true}
                autoFocus
                className="w-full pr-8 overscroll-none"
                type="text"
                value={props.value}
            />
            <div className="cursor-pointer" onClick={() => handleCopyToClipboard(props.value)}>
                <div className="absolute top-1/3 right-3">
                    <Tooltip content={copied ? "Copied" : tip}>
                        <img src={copy} alt="copy icon" title={tip} />
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}
