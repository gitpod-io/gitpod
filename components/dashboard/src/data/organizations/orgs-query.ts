/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Organization, OrgMemberInfo, User } from "@gitpod/gitpod-protocol";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useLocation } from "react-router";
import { publicApiTeamMembersToProtocol, publicApiTeamToProtocol, teamsService } from "../../service/public-api";
import { useCurrentUser } from "../../user-context";
import { noPersistence } from "../setup";
import { getOrgInvitationQueryKey } from "./org-invitation-query";
import { getOrgMembersInfoQueryKey } from "./org-members-info-query";
import { Code, ConnectError } from "@connectrpc/connect";

export interface OldOrganizationInfo extends Organization {
    members: OrgMemberInfo[];
    isOwner: boolean;
    invitationId?: string;
}

export type OrganizationInfo = Pick<Organization, "id" | "name" | "slug">;

export function useOrganizationsInvalidator() {
    const user = useCurrentUser();
    const org = useCurrentOrg();
    const queryClient = useQueryClient();
    return useCallback(() => {
        console.log("Invalidating orgs... " + JSON.stringify(getQueryKey(user)));
        queryClient.invalidateQueries(getQueryKey(user));
        queryClient.invalidateQueries(getOldQueryKey(user));
        if (org.data?.id && user?.id) {
            queryClient.invalidateQueries(getOrgInvitationQueryKey(org.data.id));
            queryClient.invalidateQueries(getOrgMembersInfoQueryKey(org.data.id, user.id));
        }
    }, [user, org.data, queryClient]);
}

export function useOldOrganizationsQuery() {
    const user = useCurrentUser();
    const query = useQuery<OldOrganizationInfo[], Error>(
        getOldQueryKey(user),
        async () => {
            console.log("Fetching orgs with old api... " + JSON.stringify(getOldQueryKey(user)));
            if (!user) {
                console.log("useOrganizations with empty user");
                return [];
            }

            const response = await teamsService.listTeams({});
            const result: OldOrganizationInfo[] = [];
            for (const org of response.teams) {
                const members = publicApiTeamMembersToProtocol(org.members || []);
                const isOwner = members.some((m) => m.role === "owner" && m.userId === user?.id);
                result.push({
                    ...publicApiTeamToProtocol(org),
                    members,
                    isOwner,
                    invitationId: org.teamInvitation?.id,
                });
            }
            return result;
        },
        {
            enabled: !!user,
            cacheTime: 1000 * 60 * 60 * 1, // 1 hour
            staleTime: 1000 * 60 * 60 * 1, // 1 hour
            // We'll let an ErrorBoundary catch the error
            useErrorBoundary: true,
        },
    );
    return query;
}

export function useOrganizations() {
    const user = useCurrentUser();
    const queryClient = useQueryClient();
    const query = useQuery<OrganizationInfo[], Error>(
        getQueryKey(user),
        async () => {
            console.log("Fetching orgs... " + JSON.stringify(getQueryKey(user)));
            if (!user) {
                console.log("useOrganizations with empty user");
                return [];
            }
            try {
                const response = await teamsService.getTeamList({});
                return response.teams;
            } catch (err) {
                const e = ConnectError.from(err);
                if (e.code === Code.Unimplemented) {
                    const data = queryClient.getQueryData<OldOrganizationInfo[]>(getOldQueryKey(user));
                    return data?.map((org) => ({
                        id: org.id,
                        name: org.name,
                        slug: org.slug,
                    }));
                }
                throw err;
            }
        },
        {
            enabled: !!user,
            cacheTime: 1000 * 60 * 60 * 1, // 1 hour
            staleTime: 1000 * 60 * 60 * 1, // 1 hour
            // We'll let an ErrorBoundary catch the error
            useErrorBoundary: true,
        },
    );
    return query;
}

export function getQueryKey(user?: User) {
    return noPersistence(["new-organizations", user?.id]);
}

export function getOldQueryKey(user?: User) {
    return noPersistence(["old-organizations", user?.id]);
}

// Custom hook to return the current org if one is selected
export function useCurrentOrg(): { data?: OrganizationInfo; isLoading: boolean } {
    const location = useLocation();
    const orgs = useOrganizations();
    const user = useCurrentUser();

    if (orgs.isLoading || !orgs.data || !user) {
        return { data: undefined, isLoading: true };
    }
    let orgId = localStorage.getItem("active-org");
    const orgIdParam = new URLSearchParams(location.search).get("org");
    if (orgIdParam) {
        orgId = orgIdParam;
    }
    let org = orgs.data.find((org) => org.id === orgId);
    if (!org) {
        org = orgs.data[0];
    }
    if (org) {
        localStorage.setItem("active-org", org.id);
    } else if (orgId && (orgs.isLoading || orgs.isStale)) {
        // orgs are still fetching, but we have an orgId
        localStorage.setItem("active-org", orgId);
    } else {
        localStorage.removeItem("active-org");
    }
    return { data: org, isLoading: false };
}
