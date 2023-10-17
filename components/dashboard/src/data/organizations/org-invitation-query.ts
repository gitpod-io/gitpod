/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "./orgs-query";
import { teamsService } from "../../service/public-api";
import { Code, ConnectError } from "@connectrpc/connect";

export const useOrgInvitationQuery = () => {
    const org = useCurrentOrg().data;

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
                    return { invitationId: org.invitationId };
                }
                throw err;
            }
        },
        enabled: !!org,
    });
};

export const getOrgInvitationQueryKey = (orgId: string) => ["org-invitation", { orgId }];
