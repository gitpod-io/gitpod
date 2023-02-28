/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { ErrorBoundary, FallbackProps, ErrorBoundaryProps } from "react-error-boundary";
import gitpodIcon from "../icons/gitpod.svg";

export const GitpodErrorBoundary: FC = ({ children }) => {
    return (
        <ErrorBoundary FallbackComponent={DefaultErrorFallback} onReset={handleReset} onError={handleError}>
            {children}
        </ErrorBoundary>
    );
};

export const DefaultErrorFallback: FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
    const emailSubject = encodeURIComponent("Gitpod Dashboard Error");
    const emailBody = encodeURIComponent(`\n\nError: ${error.message}`);

    return (
        <div role="alert" className="app-container mt-14 flex flex-col items-center justify-center space-y-6">
            <img src={gitpodIcon} className="h-16 mx-auto" alt="Gitpod's logo" />
            <h1>Oh, no! Something went wrong!</h1>
            <p className="text-lg">
                Please try reloading the page. If the issue continues, please{" "}
                <a className="gp-link" href={`mailto:support@gitpod.io?Subject=${emailSubject}&Body=${emailBody}`}>
                    get in touch
                </a>
                .
            </p>
            <div>
                <button onClick={resetErrorBoundary}>Reload</button>
            </div>
            <pre>{error.message}</pre>
        </div>
    );
};

export const handleReset: ErrorBoundaryProps["onReset"] = () => {
    window.location.reload();
};

export const handleError: ErrorBoundaryProps["onError"] = (error, info) => {
    // TODO: send metric for error boundary event
    console.error(error);
    console.info(info);
};
