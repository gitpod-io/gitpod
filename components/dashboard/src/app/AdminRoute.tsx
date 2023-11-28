/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { Redirect, Route } from "react-router";
import { UserContext } from "../user-context";

// A wrapper for <Route> that redirects to the workspaces screen if the user isn't a admin.
// This wrapper only accepts the component property
export function AdminRoute({ component }: any) {
    const { user } = useContext(UserContext);
    return (
        <Route
            render={({ location }: any) =>
                user?.rolesOrPermissions?.includes("admin") ? (
                    <Route component={component} />
                ) : (
                    <Redirect
                        to={{
                            pathname: "/workspaces",
                            state: { from: location },
                        }}
                    />
                )
            }
        />
    );
}
