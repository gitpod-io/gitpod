/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { FC, Suspense, useEffect } from "react";
import { AppLoading } from "./app/AppLoading";
import { AppRoutes } from "./app/AppRoutes";
import { useCurrentOrg } from "./data/organizations/orgs-query";
import { useAnalyticsTracking } from "./hooks/use-analytics-tracking";
import { useUserLoader } from "./hooks/use-user-loader";
import { Login } from "./Login";
import { AppBlockingFlows } from "./app/AppBlockingFlows";
import { useHistory } from "react-router";

// Wrap the App in an ErrorBoundary to catch User/Org loading errors
// This will also catch any errors that happen to bubble all the way up to the top
const AppWithErrorBoundary: FC = () => {
    return <App />;
};

export const StartWorkspaceModalKeyBinding = `${/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform) ? "⌘" : "Ctrl﹢"}O`;

// Top level Dashboard App component
const App: FC = () => {
    const { user, loading } = useUserLoader();
    const currentOrgQuery = useCurrentOrg();
    const history = useHistory();

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "o") {
                event.preventDefault();
                history.push("/new");
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [history]);

    // Setup analytics/tracking
    useAnalyticsTracking();

    if (loading) {
        return <AppLoading />;
    }

    // Technically this should get handled in the QueryErrorBoundary, but having it here doesn't hurt
    // At this point if there's no user, they should Login
    if (!user) {
        return <Login />;
    }

    // At this point we want to make sure that we never render AppRoutes prematurely, e.g. without finishing loading the orgs
    // This would cause us to re-render the whole App again soon after, creating havoc with all our "onMount" hooks.
    if (currentOrgQuery.isLoading) {
        return <AppLoading />;
    }

    // If we made it here, we have a logged in user w/ their teams. Yay.
    return (
        <Suspense fallback={<AppLoading />}>
            {/* Any required onboarding flows will be handled here before rendering the main app layout & routes */}
            <AppBlockingFlows>
                {/* Use org id *and* user id as key to force re-render on org *or* user changes. */}
                <AppRoutes key={`${currentOrgQuery?.data?.id ?? "no-org"}-${user.id}`} />
            </AppBlockingFlows>
        </Suspense>
    );
};

export default AppWithErrorBoundary;
