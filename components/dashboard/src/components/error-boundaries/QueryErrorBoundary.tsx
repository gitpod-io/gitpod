/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as GitpodCookie from "@gitpod/gitpod-protocol/lib/util/gitpod-cookie";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { FC, lazy, Suspense } from "react";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { AppLoading } from "../../app/AppLoading";
import { Login } from "../../Login";
import { isGitpodIo } from "../../utils";
import { CaughtError } from "./ReloadPageErrorBoundary";

const Setup = lazy(() => import(/* webpackPrefetch: true */ "../../Setup"));
const DedicatedOnboarding = lazy(
    () => import(/* webpackPrefetch: true */ "../../dedicated-onboarding/DedicatedOnboarding"),
);

// Error boundary intended to catch and handle expected errors from api calls
export const QueryErrorBoundary: FC = ({ children }) => {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                // Passing reset to onReset so any queries know to retry after boundary is reset
                <ErrorBoundary FallbackComponent={ExpectedQueryErrorsFallback} onReset={reset}>
                    {children}
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    );
};

// This handles any expected errors, i.e. errors w/ a code that an api call produced
const ExpectedQueryErrorsFallback: FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
    // adjust typing, as we may have caught an api error here w/ a code property
    const caughtError = error as CaughtError;

    // User needs to Login
    if (caughtError.code === ErrorCodes.NOT_AUTHENTICATED) {
        // Before we show a Login screen, check to see if we need to redirect to www site
        // Redirects if it's the root, no user, and no gp cookie present (has logged in recently)
        if (isGitpodIo() && window.location.pathname === "/" && window.location.hash === "") {
            // If there's no gp cookie, bounce to www site
            if (!GitpodCookie.isPresent(document.cookie)) {
                window.location.href = `https://www.gitpod.io`;
                return <div></div>;
            }
        }

        return <Login onLoggedIn={resetErrorBoundary} />;
    }

    // Setup needed before proceeding
    if (caughtError.code === ErrorCodes.SETUP_REQUIRED) {
        return (
            <Suspense fallback={<AppLoading />}>
                <Setup onComplete={resetErrorBoundary} />
            </Suspense>
        );
    }

    // Otherwise throw the error for default error boundary to catch and handle
    throw error;
};
