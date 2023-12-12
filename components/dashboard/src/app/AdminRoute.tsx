/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { Redirect, Route } from "react-router";
import { UserContext } from "../user-context";
import { User_RoleOrPermission } from "@gitpod/public-api/lib/gitpod/v1/user_pb";

// A wrapper for <Route> that redirects to the workspaces screen if the user isn't a admin.
// This wrapper only accepts the component property
export function AdminRoute({ component }: any) {
    const { user } = useContext(UserContext);
    return (
        <Route
            render={({ location }: any) =>
                user?.rolesOrPermissions?.includes(User_RoleOrPermission.ADMIN) ? (
                    <Route component={component}></Route>
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
