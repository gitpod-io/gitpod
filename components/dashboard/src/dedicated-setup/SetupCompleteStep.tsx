/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import { Button } from "@podkit/buttons/Button";
import { Heading1, Subheading } from "../components/typography/headings";
import Tooltip from "../components/Tooltip";
import copy from "../images/copy.svg";
import { copyToClipboard } from "../utils";
import { SetupLayout } from "./SetupLayout";
import { useTemporaryState } from "../hooks/use-temporary-value";

type Props = {
    onComplete: () => void;
};
export const SetupCompleteStep: FC<Props> = ({ onComplete }) => {
    const url = document.location.origin;
    const [copied, setCopied] = useTemporaryState(false, 2000);
    const [copyError, setCopyError] = useState<string | undefined>();

    const handleCopyToClipboard = useCallback(() => {
        copyToClipboard(url)
            .then(() => setCopied(true))
            .catch((error) => {
                if (error instanceof DOMException) {
                    setCopyError(
                        "Gitpod is not allowed to copy to clipboard. Please copy the URL manually or adjust your browser permissions.",
                    );
                    return;
                }

                setCopyError("Failed to copy to clipboard. Please copy the URL manually.");
            });
    }, [setCopied, url]);

    return (
        <SetupLayout showOrg noMaxWidth>
            <Heading1>Welcome to Gitpod</Heading1>
            <Subheading>Your teammates can now sign in to Gitpod using single sign-on (SSO).</Subheading>

            <div className="flex flex-row items-center space-x-2 mt-4">
                <div className="flex flex-row items-center space-x-1 font-mono text-sm text-pk-content-secondary">
                    {/* Keep the caret in a separate tag so triple clicking url doesn't select caret too */}
                    <pre>{`>`}</pre>
                    <pre>{url}</pre>
                </div>
                <div className="cursor-pointer" onClick={handleCopyToClipboard}>
                    <Tooltip content={copied ? "Copied" : "Click to copy"}>
                        <img src={copy} alt="copy icon" title="Click to copy" />
                    </Tooltip>
                </div>
            </div>

            <div className="my-4 text-pk-content-danger">{copyError && <p>{copyError}</p>}</div>

            <div className="mt-6 max-w-md">
                <Button className="w-full" onClick={onComplete}>
                    Add a Git Integration
                </Button>
            </div>
        </SetupLayout>
    );
};
