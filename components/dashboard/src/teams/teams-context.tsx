/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Team } from "@gitpod/gitpod-protocol";
import React, { createContext, useCallback, useContext, useMemo, useReducer, useState } from "react";
import { useRouteMatch } from "react-router";

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

function getTeamFromLocation<T extends Pick<Team, "slug">>(currentTeams?: T[]): T | undefined {
    if (!currentTeams) {
        return;
    }

    const urlTeamSlug = window.location.pathname.startsWith("/t/") ? window.location.pathname.split("/")[2] : undefined;
    if (!urlTeamSlug) {
        return;
    }

    return currentTeams.find((t) => t.slug === urlTeamSlug);
}

export function getCurrentTeam<T extends Pick<Team, "slug">>(currentTeams?: T[]): T | undefined {
    if (!currentTeams) {
        return;
    }

    const urlTeam = getTeamFromLocation(currentTeams);
    if (urlTeam) {
        return urlTeam;
    }

    const storedTeamSlug = localStorage.getItem(SELECTED_TEAM_SLUG);
    if (!storedTeamSlug) {
        return;
    }

    return currentTeams.find((t) => t.slug === storedTeamSlug);
}

export function useCurrentTeam() {
    const [, forceUpdate] = useReducer((x) => x + 1, 0);

    const { teams } = useContext(TeamsContext);
    const match = useRouteMatch<{ teamSlug: string }>("/t/:teamSlug");
    const teamSlugFromUrl = match?.params.teamSlug ?? "";

    const urlTeam = useMemo(() => {
        if (teamSlugFromUrl) {
            return teams?.find((t) => t.slug === teamSlugFromUrl);
        }
    }, [teamSlugFromUrl, teams]);

    const storedTeam = useMemo(() => {
        if (urlTeam) {
            return urlTeam;
        }

        const teamSlugFromStorage = localStorage.getItem(SELECTED_TEAM_SLUG) ?? "";
        if (teamSlugFromStorage) {
            return teams?.find((t) => t.slug === teamSlugFromStorage);
        }
    }, [urlTeam, teams]);

    const team = storedTeam;

    localStorage.setItem(SELECTED_TEAM_SLUG, team?.slug ?? "");

    const setStoredTeamSlug = useCallback(
        (slug: Team["slug"] = "") => {
            if (slug && !teams?.some((t) => t.slug === slug)) {
                return;
            }

            localStorage.setItem(SELECTED_TEAM_SLUG, slug);
            forceUpdate();
        },
        [teams],
    );

    return {
        team,
        urlTeam,
        isUrlTeamNotFound: !!teamSlugFromUrl && !urlTeam,
        storedTeam,
        setStoredTeamSlug,
    };
}
