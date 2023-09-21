/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { QueryErrorResetBoundary, useQueryClient } from "@tanstack/react-query";
import { FC } from "react";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { hasLoggedInBefore, Login } from "../../Login";
import { isGitpodIo } from "../../utils";
import { CaughtError } from "./ReloadPageErrorBoundary";

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
    const client = useQueryClient();
    // adjust typing, as we may have caught an api error here w/ a code property
    const caughtError = error as CaughtError;

    // User needs to Login
    if (caughtError.code === ErrorCodes.NOT_AUTHENTICATED) {
        console.log("clearing query cache for unauthenticated user");
        client.clear();
        // Before we show a Login screen, check to see if we need to redirect to www site
        // Redirects if it's the root, no user, and no gp cookie present (has logged in recently)
        if (isGitpodIo() && window.location.pathname === "/" && window.location.hash === "") {
            // If there's no gp cookie, bounce to www site
            if (!hasLoggedInBefore()) {
                window.location.href = `https://www.gitpod.io`;
                return <div></div>;
            }
        }

        return <Login onLoggedIn={resetErrorBoundary} />;
    }

    // Otherwise throw the error for default error boundary to catch and handle
    throw error;
};
