/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from '@gitpod/gitpod-protocol';
import React, { createContext, useState } from 'react';

const UserContext = createContext<{
    user?: User;
    setUser: React.Dispatch<User>;
}>({
    setUser: () => null,
});

const UserContextProvider: React.FC = ({ children }) => {
    const [user, setUser] = useState<User>();
    return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;
};

export { UserContext, UserContextProvider };
