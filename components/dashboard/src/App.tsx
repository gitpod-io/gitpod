/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as GitpodCookie from "@gitpod/gitpod-protocol/lib/util/gitpod-cookie";
import React, { FunctionComponent, Suspense } from "react";
import { AppLoading } from "./app/AppLoading";
import { AppRoutes } from "./app/AppRoutes";
import { useCurrentOrg } from "./data/organizations/orgs-query";
import { useAnalyticsTracking } from "./hooks/use-analytics-tracking";
import { useUserAndTeamsLoader } from "./hooks/use-user-and-teams-loader";
import { Login } from "./Login";
import { isGitpodIo } from "./utils";

const Setup = React.lazy(() => import(/* webpackPrefetch: true */ "./Setup"));

// Top level Dashboard App component
const App: FunctionComponent = () => {
    const { user, isSetupRequired, loading } = useUserAndTeamsLoader();
    const currentOrgQuery = useCurrentOrg();

    // Setup analytics/tracking
    useAnalyticsTracking();

    if (loading) {
        return <AppLoading />;
    }

    // This may be flagged true during user/teams loading
    if (isSetupRequired) {
        return (
            <Suspense fallback={<AppLoading />}>
                <Setup />
            </Suspense>
        );
    }

    // Redirects to www site if it's the root, no user, and no gp cookie present (has logged in recently)
    // Should come after the <Setup/> check
    if (isGitpodIo() && window.location.pathname === "/" && window.location.hash === "" && !user) {
        // If there's no gp cookie, bounce to www site
        if (!GitpodCookie.isPresent(document.cookie)) {
            window.location.href = `https://www.gitpod.io`;
            return <div></div>;
        }
    }

    // At this point if there's no user, they should Login
    if (!user) {
        return <Login />;
    }

    // At this point we want to make sure that we never render AppRoutes prematurely, e.g. without an Org.
    // This would cause us to re-render the whole App again soon after, creating havoc with all our "onMount" hooks.
    if (currentOrgQuery.isLoading || !currentOrgQuery.data) {
        return <AppLoading />;
    }

    // If we made it here, we have a logged in user w/ their teams. Yay.
    return (
        <Suspense fallback={<AppLoading />}>
            {/* Use org id as key to force re-render on org change */}
            <AppRoutes key={currentOrgQuery.data.id} />
        </Suspense>
    );
};

export default App;
