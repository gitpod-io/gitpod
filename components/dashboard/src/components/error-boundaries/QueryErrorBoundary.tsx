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
import { gitpodHostUrl } from "../../service/service";
import QuickStart from "../QuickStart";
import { DisabledCell } from "../../cell-disabled/DisabledCell";

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

    // user deleted needs a n explicit logout to destroy the session
    if (caughtError.code === ErrorCodes.USER_DELETED) {
        console.log("clearing query cache for deleted user");
        client.clear();

        // redirect to <domain>/logout
        const loginUrl = gitpodHostUrl
            .withApi({
                pathname: "/login",
                search: `returnTo=${encodeURIComponent(window.location.href)}`,
            })
            .toString();

        const logoutUrl = gitpodHostUrl
            .withApi({
                pathname: "/logout",
                search: `returnTo=${encodeURIComponent(loginUrl)}`,
            })
            .toString();
        window.location.href = logoutUrl;
        return <div></div>;
    }

    if (caughtError.code === ErrorCodes.CELL_EXPIRED) {
        return <DisabledCell />;
    }

    // User needs to Login
    if (caughtError.code === ErrorCodes.NOT_AUTHENTICATED) {
        console.log("clearing query cache for unauthenticated user");
        client.clear();

        // Page can be loaded even if user is not authenticated
        // RegEx is used for accounting for trailing slash /
        if (window.location.pathname.replace(/\/$/, "") === "/quickstart") {
            return <QuickStart />;
        }

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
