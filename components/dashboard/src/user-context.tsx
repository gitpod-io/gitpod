/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from '@gitpod/gitpod-protocol';
import React, { createContext, useState } from 'react';

const UserContext = createContext<{
    user?: User,
    userLoadError?: string,
    setUser: React.Dispatch<User>,
    setUserLoadError: React.Dispatch<string | undefined>,
}>({
    setUser: () => null,
    setUserLoadError: (error: string | undefined) => null
});


const UserContextProvider: React.FC = ({ children }) => {
    const [userState, setUserState] = useState<{ user?: User, userLoadError?: string }>({});
    const { user, userLoadError} = userState;

    return (
        <UserContext.Provider value={{ user, userLoadError, setUser: (user: User) => setUserState({ user }), setUserLoadError: (userLoadError) => setUserState({ userLoadError }) }}>
            {children}
        </UserContext.Provider>
    )
}

export { UserContext, UserContextProvider };
