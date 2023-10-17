/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OldOrganizationInfo, getOldQueryKey, useCurrentOrg } from "./orgs-query";
import { teamsService } from "../../service/public-api";
import { Code, ConnectError } from "@connectrpc/connect";
import { useCurrentUser } from "../../user-context";

export const useOrgInvitationQuery = () => {
    const user = useCurrentUser();
    const org = useCurrentOrg().data;
    const queryClient = useQueryClient();

    return useQuery<{ invitationId?: string }>({
        queryKey: getOrgInvitationQueryKey(org?.id ?? ""),
        staleTime: 1000 * 60 * 2, // 2 minute
        queryFn: async () => {
            if (!org) {
                throw new Error("No org selected.");
            }
            try {
                const resp = await teamsService.getTeamInvitation({ teamId: org.id });
                return { invitationId: resp.teamInvitation?.id };
            } catch (err) {
                const e = ConnectError.from(err);
                if (e.code === Code.Unimplemented) {
                    const data = queryClient.getQueryData<OldOrganizationInfo[]>(getOldQueryKey(user));
                    const foundOrg = data?.find((orgInfo) => orgInfo.id === org.id);
                    return { invitationId: foundOrg?.invitationId };
                }
                throw err;
            }
        },
        enabled: !!org,
    });
};

export const getOrgInvitationQueryKey = (orgId: string) => ["org-invitation", { orgId }];
