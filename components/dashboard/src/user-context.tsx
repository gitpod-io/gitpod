/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useState, useContext, useMemo, useCallback } from "react";
import { updateCommonErrorDetails } from "./service/metrics";
import { updateUserForExperiments } from "./service/public-api";
import { getPrimaryEmail } from "@gitpod/public-api-common/lib/user-utils";

const UserContext = createContext<{
    user?: User;
    setUser: React.Dispatch<User>;
}>({
    setUser: () => null,
});

const refetchCookie = async () => {
    await fetch("/api/auth/jwt-cookie", {
        credentials: "include",
    })
        .then((resp) => resp.text())
        .then((text) => console.log(`Completed JWT Cookie refresh: ${text}`))
        .catch((err) => {
            console.log("Failed to update jwt-cookie", err);
        });
};

const UserContextProvider: React.FC = ({ children }) => {
    const [user, setUser] = useState<User>();

    const updateServiceUser = (user?: User) => {
        updateCommonErrorDetails({ userId: user?.id });
        updateUserForExperiments(!!user ? { id: user.id, email: getPrimaryEmail(user) } : undefined);
    };
    updateServiceUser(user);

    const client = useQueryClient();

    const doSetUser = useCallback(
        (updatedUser: User) => {
            updateServiceUser(updatedUser);
            // If user has changed clear cache
            // Ignore the case where user hasn't been set yet - initial load
            if (user && user?.id !== updatedUser.id) {
                client.clear();
            }
            setUser(updatedUser);

            // Schedule a periodic refresh of JWT cookie
            const w = window as any;
            const _gp = w._gp || (w._gp = {});

            const frequencyMs = 1000 * 60 * 5; // 5 mins
            if (!_gp.jwttimer) {
                // Store the timer on the window, to avoid queuing up multiple
                _gp.jwtTimer = setInterval(refetchCookie, frequencyMs);

                setTimeout(refetchCookie, 20_000);
            }
        },
        [user, client],
    );

    // Wrap value in useMemo to avoid unnecessary re-renders
    const ctxValue = useMemo(() => ({ user, setUser: doSetUser }), [user, doSetUser]);

    return <UserContext.Provider value={ctxValue}>{children}</UserContext.Provider>;
};

export { UserContext, UserContextProvider };

export const useCurrentUser = () => {
    const { user } = useContext(UserContext);
    return user;
};
