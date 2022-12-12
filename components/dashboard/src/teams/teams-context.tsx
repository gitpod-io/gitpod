/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Team } from "@gitpod/gitpod-protocol";
import React, { createContext, useContext, useState } from "react";
import { Location } from "history";
import { useLocation } from "react-router";

export const TeamsContext = createContext<{
    teams?: Team[];
    setTeams: React.Dispatch<Team[]>;
}>({
    setTeams: () => null,
});

export const TeamsContextProvider: React.FC = ({ children }) => {
    const [teams, setTeams] = useState<Team[]>();
    return <TeamsContext.Provider value={{ teams, setTeams }}>{children}</TeamsContext.Provider>;
};

export function getCurrentTeam(location: Location<any>, teams?: Team[]): Team | undefined {
    if (!teams) {
        return;
    }
    const slug = location.pathname.startsWith("/t/") ? location.pathname.split("/")[2] : undefined;
    if (slug === undefined && ["projects"].indexOf(location.pathname.split("/")[1]) === -1) {
        return undefined;
    }
    const team = teams.find((t) => t.slug === slug);
    localStorage.setItem("team-selection", team?.slug || "");
    return team;
}

export function getSelectedTeamSlug(): string {
    return localStorage.getItem("team-selection") || "";
}

// Helper hook to return the current team if one is selected
export function useCurrentTeam(): Team | undefined {
    const location = useLocation();
    const { teams } = useContext(TeamsContext);

    return getCurrentTeam(location, teams);
}
