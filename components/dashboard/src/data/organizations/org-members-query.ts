/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamMemberInfo } from "@gitpod/gitpod-protocol";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { publicApiTeamMembersToProtocol, teamsService } from "../../service/public-api";
import { useCurrentTeam } from "../../teams/teams-context";
import { useCurrentUser } from "../../user-context";

export type OrgMembersQueryResult = TeamMemberInfo[];

export const useOrgMembers = () => {
    const organization = useCurrentTeam();

    return useQuery<OrgMembersQueryResult>({
        queryKey: getOrgMembersQueryKey(organization?.id ?? ""),
        queryFn: async () => {
            if (!organization) {
                throw new Error("No current organization");
            }
            const resp = await teamsService.getTeam({ teamId: organization.id });

            return publicApiTeamMembersToProtocol(resp.team?.members || []);
        },
    });
};

// Wrapper around useOrgMembers to get the current user's, current orgs member info record
export const useCurrentOrgMember = () => {
    const user = useCurrentUser();

    const { data: members, isLoading } = useOrgMembers();

    return useMemo(() => {
        let member: TeamMemberInfo | undefined;
        let isOwner = false;

        if (!isLoading && members && user) {
            member = members.find((m) => m.userId === user.id);
            isOwner = member?.role === "owner";
        }

        return { isLoading, member, isOwner };
    }, [isLoading, members, user]);
};

export const getOrgMembersQueryKey = (organizationId: string) => ["organizations", { organizationId }, "members"];
