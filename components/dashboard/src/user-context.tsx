/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import React, { createContext, useState, useCallback, useContext } from "react";
import { getGitpodService } from "./service/service";

const UserContext = createContext<{
    user?: User;
    setUser: React.Dispatch<User>;
    userBillingMode?: BillingMode;
    refreshUserBillingMode: () => void;
}>({
    setUser: () => null,
    refreshUserBillingMode: () => null,
});

const UserContextProvider: React.FC = ({ children }) => {
    const [user, setUser] = useState<User>();
    const [billingMode, setBillingMode] = useState<BillingMode>();

    const refreshUserBillingMode = useCallback(() => {
        return getGitpodService().server.getBillingModeForUser().then(setBillingMode);
    }, []);

    return (
        <UserContext.Provider value={{ user, setUser, userBillingMode: billingMode, refreshUserBillingMode }}>
            {children}
        </UserContext.Provider>
    );
};

export { UserContext, UserContextProvider };

export const useCurrentUser = () => {
    const { user } = useContext(UserContext);
    return user;
};
