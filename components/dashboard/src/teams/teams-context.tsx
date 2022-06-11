/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Team } from "@gitpod/gitpod-protocol";
import { Location } from "history";
import React, { createContext, useState } from "react";

export const SELECTED_TEAM_SLUG = "team-selection";

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

function getTeamFromLocation<T extends Pick<Team, "slug">>(
    location: Pick<Location, "pathname">,
    teams?: T[],
): T | undefined {
    if (!teams) {
        return;
    }

    const urlTeamSlug = location.pathname.startsWith("/t/") ? location.pathname.split("/")[2] : undefined;

    if (!urlTeamSlug) {
        return;
    }

    return teams.find((t) => t.slug === urlTeamSlug);
}

export function getCurrentTeam<T extends Pick<Team, "slug">>(
    location: Pick<Location, "pathname">,
    teams?: T[],
): T | undefined {
    if (!teams) {
        return;
    }

    const teamFromUrl = getTeamFromLocation(location, teams);
    if (teamFromUrl) {
        return teamFromUrl;
    }

    const storedTeamSlug = localStorage.getItem(SELECTED_TEAM_SLUG);
    if (!storedTeamSlug) {
        return;
    }

    return teams.find((t) => t.slug === storedTeamSlug);
}

export function setCurrentTeam(team: Pick<Team, "slug"> = { slug: "" }) {
    localStorage.setItem(SELECTED_TEAM_SLUG, team.slug);
}
