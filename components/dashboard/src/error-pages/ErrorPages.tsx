/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, Suspense, lazy } from "react";
import { Route, Switch, useRouteMatch } from "react-router";
import { AppLoading } from "../app/AppLoading";

const ExpiredOTS = lazy(() => import("./ExpiredOTS"));
const DefaultError = lazy(() => import("./DefaultError"));

// Mounted under the `/error` path
// Intended to handle error pages we can redirect to w/ distinct urls
export const ErrorPages: FC = () => {
    const match = useRouteMatch();

    return (
        <Suspense fallback={<AppLoading />}>
            <Switch>
                {/* Matching /error/expired-ots */}
                <Route path={`${match.path}/expired-ots`} exact component={ExpiredOTS} />
                {/* Matching any error/* routes */}
                <Route path={match.path} component={DefaultError} />
            </Switch>
        </Suspense>
    );
};
