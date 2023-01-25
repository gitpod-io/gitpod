/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useCurrentTeam } from "../../teams/teams-context";

type OrgBillingModeQueryResult = BillingMode;

export const useOrgBillingMode = () => {
    const team = useCurrentTeam();

    return useQuery<OrgBillingModeQueryResult>({
        queryKey: getOrgBillingModeQueryKey(team?.id ?? ""),
        queryFn: async () => {
            if (!team) {
                throw new Error("No current organization selected");
            }
            return await getGitpodService().server.getBillingModeForTeam(team.id);
        },
        enabled: !!team,
    });
};

export const getOrgBillingModeQueryKey = (organizationId: string) => ["billing-mode", { organizationId }];
