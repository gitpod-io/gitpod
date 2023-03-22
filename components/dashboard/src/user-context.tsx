/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import React, { createContext, useState, useContext, useMemo } from "react";

const UserContext = createContext<{
    user?: User;
    setUser: React.Dispatch<User>;
}>({
    setUser: () => null,
});

const UserContextProvider: React.FC = ({ children }) => {
    const [user, setUser] = useState<User>();

    // Wrap value in useMemo to avoid unnecessary re-renders
    const ctxValue = useMemo(() => ({ user, setUser }), [user, setUser]);

    return <UserContext.Provider value={ctxValue}>{children}</UserContext.Provider>;
};

export { UserContext, UserContextProvider };

export const useCurrentUser = () => {
    const { user } = useContext(UserContext);
    return user;
};
