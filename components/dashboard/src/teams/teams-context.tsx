/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Team, TeamMemberInfo } from "@gitpod/gitpod-protocol";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { publicApiTeamMembersToProtocol, teamsService } from "../service/public-api";
import { useCurrentUser } from "../user-context";

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

// Helper hook to return the current org if one is selected
export function useCurrentTeam(): Team | undefined {
    const location = useLocation();
    const teams = useTeams();
    const user = useCurrentUser();

    if (!teams) {
        return;
    }
    let orgId = localStorage.getItem("active-org");
    const orgIdParam = new URLSearchParams(location.search).get("org");
    if (orgIdParam) {
        orgId = orgIdParam;
    }
    let org = teams.find((t) => t.id === orgId);
    if (!org && user?.additionalData?.isMigratedToTeamOnlyAttribution) {
        // if the user is migrated to team-only attribution, we return the first org
        org = teams[0];
    }
    if (org) {
        localStorage.setItem("active-org", org.id);
    } else {
        localStorage.removeItem("active-org");
    }
    return org;
}

export function useTeams(): Team[] | undefined {
    const { teams } = useContext(TeamsContext);
    return teams;
}

export function useTeamMemberInfos(): Record<string, TeamMemberInfo[]> {
    const [teamMembers, setTeamMembers] = useState<Record<string, TeamMemberInfo[]>>({});
    const teams = useTeams();

    useEffect(() => {
        if (!teams) {
            return;
        }
        (async () => {
            const members: Record<string, TeamMemberInfo[]> = {};
            for (const team of teams) {
                try {
                    members[team.id] = publicApiTeamMembersToProtocol(
                        (await teamsService.getTeam({ teamId: team!.id })).team?.members || [],
                    );
                } catch (error) {
                    console.error("Could not get members of team", team, error);
                }
            }
            setTeamMembers(members);
        })();
    }, [teams]);
    return teamMembers;
}

export function useIsOwnerOfCurrentTeam(): boolean {
    const team = useCurrentTeam();
    const teamMemberInfos = useTeamMemberInfos();

    if (!team || !teamMemberInfos[team.id]) {
        return true;
    }
    return teamMemberInfos[team.id]?.some((tmi) => tmi.role === "owner") || false;
}
