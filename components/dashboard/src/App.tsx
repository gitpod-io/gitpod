/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { FunctionComponent, Suspense, useEffect } from "react";
import { Login } from "./Login";
import { Experiment } from "./experiments";
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

    // Setup experiments
    useEffect(() => {
        if (isGitpodIo()) {
            // Choose which experiments to run for this session/user
            Experiment.set(Experiment.seed(true));
        }
    }, []);

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
