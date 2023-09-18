/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback } from "react";
import { ErrorBoundary, ErrorBoundaryProps, FallbackProps } from "react-error-boundary";
import gitpodIcon from "../../icons/gitpod.svg";
import { Heading1, Subheading } from "../typography/headings";
import { reportError } from "../../service/metrics";

export type CaughtError = Error & { code?: number };

// Catches any unexpected errors w/ a UI to reload the page. Also reports errors to api
export const ReloadPageErrorBoundary: FC = ({ children }) => {
    return (
        <ErrorBoundary FallbackComponent={ReloadPageErrorFallback} onError={handleError}>
            {children}
        </ErrorBoundary>
    );
};

export const ReloadPageErrorFallback: FC<Pick<FallbackProps, "error">> = ({ error }) => {
    // adjust typing, as we may have caught an api error here w/ a code property
    const caughtError = error as CaughtError;

    const handleReset = useCallback(() => {
        window.location.reload();
    }, []);

    const emailSubject = encodeURIComponent("Gitpod Dashboard Error");
    let emailBodyStr = `\n\nError: ${caughtError.message}`;
    if (caughtError.code) {
        emailBodyStr += `\nCode: ${caughtError.code}`;
    }
    const emailBody = encodeURIComponent(emailBodyStr);

    return (
        <div role="alert" className="app-container mt-14 flex flex-col items-center justify-center space-y-6">
            <img src={gitpodIcon} className="h-16 mx-auto" alt="Gitpod's logo" />
            <Heading1>Oh, no! Something went wrong!</Heading1>
            <Subheading>
                Please try reloading the page. If the issue continues, please{" "}
                <a className="gp-link" href={`mailto:support@gitpod.io?Subject=${emailSubject}&Body=${emailBody}`}>
                    get in touch
                </a>
                .
            </Subheading>
            <div>
                <button onClick={handleReset}>Reload</button>
            </div>
            <div className="flex flex-col items-center space-y-2">
                {caughtError.code && (
                    <span>
                        <strong>Code:</strong> {caughtError.code}
                    </span>
                )}
                {caughtError.message && (
                    <pre className="max-w-3xl whitespace-normal text-sm">{caughtError.message}</pre>
                )}
            </div>
        </div>
    );
};

export const handleError: ErrorBoundaryProps["onError"] = (error, info) => reportError("Error boundary", error, info);
