/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Team } from '@gitpod/gitpod-protocol';
import React, { createContext, useState } from 'react';
import { Location } from "history";

export const TeamsContext = createContext<{
    teams?: Team[],
    setTeams: React.Dispatch<Team[]>,
}>({
    setTeams: () => null,
});


export const TeamsContextProvider: React.FC = ({ children }) => {
    const [ teams, setTeams ] = useState<Team[]>();
    return (
        <TeamsContext.Provider value={{ teams, setTeams }}>
            {children}
        </TeamsContext.Provider>
    )
}

export function getCurrentTeam(location: Location<any>, teams?: Team[]): Team | undefined {
    const slug = location.pathname.startsWith('/t/') ? location.pathname.split('/')[2] : undefined;
    if (!slug || !teams) {
        return;
    }
    return teams.find(t => t.slug === slug);
}
