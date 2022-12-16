/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Team, User } from "@gitpod/gitpod-protocol";
import { FunctionComponent, Suspense, lazy } from "react";
import { AppRoutes } from "./AppRoutes";
import { Blocked } from "./Blocked";
import { AppLoading } from "./AppLoading";

const OAuthClientApproval = lazy(() => import(/* webpackPrefetch: true */ "../OauthClientApproval"));

type LoggedInAppProps = {
    user: User;
    teams?: Team[];
};
export const LoggedInApp: FunctionComponent<LoggedInAppProps> = ({ user, teams }) => {
    // TODO: Add a Route for this instead of inspecting location manually
    if (window.location.pathname.startsWith("/blocked")) {
        return <Blocked />;
    }

    // TODO: Add a Route for this instead
    if (window.location.pathname.startsWith("/oauth-approval")) {
        return (
            <Suspense fallback={<AppLoading />}>
                <OAuthClientApproval />
            </Suspense>
        );
    }

    return (
        <Suspense fallback={<AppLoading />}>
            <AppRoutes user={user} teams={teams} />
        </Suspense>
    );
};
