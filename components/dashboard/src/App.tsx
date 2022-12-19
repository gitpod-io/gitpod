/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { FunctionComponent, Suspense, useEffect } from "react";
import { Login } from "./Login";
import * as GitpodCookie from "@gitpod/gitpod-protocol/lib/util/gitpod-cookie";
import { Experiment } from "./experiments";
import { isGitpodIo, getURLHash } from "./utils";
import { useUserAndTeamsLoader } from "./hooks/use-user-and-teams-loader";
import { useAnalyticsTracking } from "./hooks/use-analytics-tracking";
import { AppLoading } from "./app/AppLoading";
import { isWebsiteSlug } from "./app/is-website-slug";
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

    // TODO: Add some context to what this logic is for
    useEffect(() => {
        const onHashChange = () => {
            // Refresh on hash change if the path is '/' (new context URL)
            if (window.location.pathname === "/") {
                window.location.reload();
            }
        };
        window.addEventListener("hashchange", onHashChange, false);

        return () => {
            window.removeEventListener("hashchange", onHashChange);
        };
    }, []);

    // TODO: pull this redirect out of main react render if we only need to do it on page load
    // redirect to website for any website slugs
    if (isGitpodIo() && isWebsiteSlug(window.location.pathname)) {
        window.location.host = "www.gitpod.io";
        return <div></div>;
    }

    if (loading) {
        return <AppLoading />;
    }

    // TODO: Add some context to what this logic is for, does it have to happen every render, or just page load?
    if (isGitpodIo() && window.location.pathname === "/" && window.location.hash === "" && !user) {
        // If there's no gp cookie, bounce to www site
        if (!GitpodCookie.isPresent(document.cookie)) {
            window.location.href = `https://www.gitpod.io`;
            return <div></div>;
        } else {
            // explicitly render the Login page when the session is out-of-sync with the Gitpod cookie
            return <Login />;
        }
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

    // TODO: Add some context to what this logic is for
    const hash = getURLHash();
    if (/^(https:\/\/)?github\.dev\//i.test(hash)) {
        window.location.hash = hash.replace(/^(https:\/\/)?github\.dev\//i, "https://github.com/");
        return <div></div>;
    } else if (/^([^\/]+?=[^\/]*?|prebuild)\/(https:\/\/)?github\.dev\//i.test(hash)) {
        window.location.hash = hash.replace(
            /^([^\/]+?=[^\/]*?|prebuild)\/(https:\/\/)?github\.dev\//i,
            "$1/https://github.com/",
        );
        return <div></div>;
    }

    // If we made it here, we have a logged in user w/ their teams. Yay.
    return (
        <Suspense fallback={<AppLoading />}>
            <AppRoutes user={user} teams={teams} />
        </Suspense>
    );
};

export default App;
