/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Redirect, Route } from "react-router";
import { useCurrentTeam } from "../teams/teams-context";

// A wrapper for <Route> that redirects to "/" if there is not an organization currently selected
// Having a check for an active org at the route level allows us to avoid any org-dependant api calls we might make
// in page level components, and having to check for an org there
export function OrgRequiredRoute({ component }: any) {
    const org = useCurrentTeam();

    return <Route render={() => (!!org ? <Route component={component} /> : <Redirect to={"/"} />)} />;
}
