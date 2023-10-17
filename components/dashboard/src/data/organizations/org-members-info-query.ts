/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrgMemberInfo } from "@gitpod/gitpod-protocol";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OldOrganizationInfo, getOldQueryKey, useCurrentOrg } from "./orgs-query";
import { publicApiTeamMembersToProtocol, teamsService } from "../../service/public-api";
import { useCurrentUser } from "../../user-context";
import { TeamRole } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_pb";
import { Code, ConnectError } from "@connectrpc/connect";

export interface OrgMembersInfo {
    members: OrgMemberInfo[];
    isOwner: boolean;
}

export const useOrgMembersInfoQuery = () => {
    const user = useCurrentUser();
    const org = useCurrentOrg().data;
    const queryClient = useQueryClient();

    return useQuery<OrgMembersInfo>({
        queryKey: getOrgMembersInfoQueryKey(org?.id ?? "", user?.id ?? ""),
        staleTime: 1000 * 60 * 1, // 1 minute
        queryFn: async () => {
            if (!org) {
                throw new Error("No org selected.");
            }
            try {
                const resp = await teamsService.listTeamMembers({ teamId: org.id });
                return {
                    members: publicApiTeamMembersToProtocol(resp.members),
                    isOwner:
                        resp.members.findIndex(
                            (member) => member.userId === user?.id && member.role === TeamRole.OWNER,
                        ) >= 0,
                };
            } catch (err) {
                const e = ConnectError.from(err);
                if (e.code === Code.Unimplemented) {
                    const data = queryClient.getQueryData<OldOrganizationInfo[]>(getOldQueryKey(user));
                    const foundOrg = data?.find((orgInfo) => orgInfo.id === org.id);
                    return {
                        members: foundOrg?.members ?? [],
                        isOwner: foundOrg?.isOwner ?? false,
                    };
                }
                throw err;
            }
        },
        enabled: !!org && !!user,
    });
};

export const getOrgMembersInfoQueryKey = (orgId: string, userId: string) => ["org-members", { orgId, userId }];
