/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { FC, lazy, Suspense, useCallback } from "react";
import { ErrorBoundary, FallbackProps, ErrorBoundaryProps } from "react-error-boundary";
import { AppLoading } from "../app/AppLoading";
import gitpodIcon from "../icons/gitpod.svg";
import { Login } from "../Login";
import { getGitpodService } from "../service/service";
import { Heading1, Subheading } from "./typography/headings";

const Setup = lazy(() => import(/* webpackPrefetch: true */ "../Setup"));

// This is the outermost error boundary, which catches user and org loading errors
// or others that we let bubble up to the top
export const TopLevelErrorBoundary: FC = ({ children }) => {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                // Passing reset to onReset so any queries know to retry after boundary is reset
                <ErrorBoundary FallbackComponent={TopLevelErrorFallback} onReset={reset} onError={handleError}>
                    {children}
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    );
};

export const GitpodErrorBoundary: FC = ({ children }) => {
    return (
        <ErrorBoundary FallbackComponent={DefaultErrorFallback} onError={handleError}>
            {children}
        </ErrorBoundary>
    );
};

type CaughtError = Error & { code?: number };

const TopLevelErrorFallback: FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
    // adjust typing, as we may have caught an api error here w/ a code property
    const caughtError = error as CaughtError;

    // Handle any expected errors here
    if (caughtError.code === ErrorCodes.NOT_AUTHENTICATED) {
        return <Login onLoggedIn={resetErrorBoundary} />;
    }

    if (caughtError.code === ErrorCodes.SETUP_REQUIRED) {
        return (
            <Suspense fallback={<AppLoading />}>
                <Setup onComplete={resetErrorBoundary} />
            </Suspense>
        );
    }

    // Otherwise fall back to default error view
    return <DefaultErrorFallback error={error} />;
};

export const DefaultErrorFallback: FC<Pick<FallbackProps, "error">> = ({ error }) => {
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
            <div>
                {caughtError.code && (
                    <span>
                        <strong>Code:</strong> {caughtError.code}
                    </span>
                )}
                {caughtError.message && <pre>{caughtError.message}</pre>}
            </div>
        </div>
    );
};

export const handleError: ErrorBoundaryProps["onError"] = async (error, info) => {
    const url = window.location.toString();
    try {
        await getGitpodService().server.reportErrorBoundary(url, error.message || "Unknown Error");
    } catch (e) {
        console.error(e);
    }
};
