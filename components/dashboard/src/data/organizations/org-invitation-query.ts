/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "./orgs-query";
import { teamsService } from "../../service/public-api";

export const useOrgInvitationQuery = () => {
    const org = useCurrentOrg().data;

    return useQuery<{ invitationId?: string }>({
        queryKey: getOrgInvitationQueryKey(org?.id ?? ""),
        staleTime: 1000 * 60 * 10, // 10 minute
        queryFn: async () => {
            if (!org) {
                throw new Error("No org selected.");
            }

            const resp = await teamsService.getTeamInvitation({ teamId: org.id });
            return { invitationId: resp.teamInvitation?.id };
        },
        enabled: !!org,
    });
};

export const getOrgInvitationQueryKey = (orgId: string) => ["org-invitation", { orgId }];
