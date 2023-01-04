/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { FunctionComponent, Suspense } from "react";
import * as GitpodCookie from "@gitpod/gitpod-protocol/lib/util/gitpod-cookie";
import { Login } from "./Login";
import { isGitpodIo } from "./utils";
import { useUserAndTeamsLoader } from "./hooks/use-user-and-teams-loader";
import { useAnalyticsTracking } from "./hooks/use-analytics-tracking";
import { AppLoading } from "./app/AppLoading";
import { AppRoutes } from "./app/AppRoutes";

const Setup = React.lazy(() => import(/* webpackPrefetch: true */ "./Setup"));

// Top level Dashboard App component
const App: FunctionComponent = () => {
    const { user, teams, isSetupRequired, loading } = useUserAndTeamsLoader();

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

    // If we made it here, we have a logged in user w/ their teams. Yay.
    return (
        <Suspense fallback={<AppLoading />}>
            <AppRoutes user={user} teams={teams} />
        </Suspense>
    );
};

export default App;
