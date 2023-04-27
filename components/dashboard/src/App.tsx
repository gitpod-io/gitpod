/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { FC, Suspense } from "react";
import { AppLoading } from "./app/AppLoading";
import { AppRoutes } from "./app/AppRoutes";
import { useCurrentOrg } from "./data/organizations/orgs-query";
import { useAnalyticsTracking } from "./hooks/use-analytics-tracking";
import { useUserLoader } from "./hooks/use-user-loader";
import { Login } from "./Login";
import { MigrationPage, useShouldSeeMigrationPage } from "./whatsnew/MigrationPage";
import { useAuthProviders } from "./data/auth-providers/auth-provider-query";
import { AppBlockingFlows } from "./app/AppBlockingFlows";

// Wrap the App in an ErrorBoundary to catch User/Org loading errors
// This will also catch any errors that happen to bubble all the way up to the top
const AppWithErrorBoundary: FC = () => {
    return <App />;
};

// Top level Dashboard App component
const App: FC = () => {
    // Kick off this request early, as we'll need it to determine if we need to require sso config for dedicated onboarding
    useAuthProviders();
    const { user, loading } = useUserLoader();
    const currentOrgQuery = useCurrentOrg();
    const shouldSeeMigrationPage = useShouldSeeMigrationPage();

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

    // TODO: Can we shift this into AppBlockingFlows as well? Does it matter if we wait until org query finishes to show this?
    // If orgOnlyAttribution is enabled and the user hasn't been migrated, yet, we need to show the migration page
    if (shouldSeeMigrationPage) {
        return <MigrationPage />;
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
                {/* Use org id, or user id (for personal account) as key to force re-render on org change */}
                <AppRoutes key={currentOrgQuery?.data?.id ?? user.id} />
            </AppBlockingFlows>
        </Suspense>
    );
};

export default AppWithErrorBoundary;
