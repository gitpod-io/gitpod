import { User } from '@gitpod/gitpod-protocol';
import React, { createContext, useState } from 'react';

const UserContext = createContext<{
    user?: User,
    setUser: React.Dispatch<User>
}>({
    setUser: () => null
});


const AppProvider: React.FC = ({ children }) => {
    const [user, setUser] = useState<User | undefined>(undefined);

    return (
        <UserContext.Provider value={{ user, setUser }}>
            {children}
        </UserContext.Provider>
    )
}

export { UserContext, AppProvider };
