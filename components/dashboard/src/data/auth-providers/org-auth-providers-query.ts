/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderEntry } from "@gitpod/gitpod-protocol";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getGitpodService } from "../../service/service";
import { useCurrentTeam } from "../../teams/teams-context";

export type OrgAuthProvidersQueryResult = AuthProviderEntry[];
export const useOrgAuthProvidersQuery = () => {
    const organization = useCurrentTeam();

    return useQuery<OrgAuthProvidersQueryResult>({
        queryKey: getOrgAuthProvidersQueryKey(organization?.id ?? ""),
        queryFn: async () => {
            if (!organization) {
                throw new Error("No current organization selected");
            }

            return await getGitpodService().server.getOrgAuthProviders({ organizationId: organization.id });
        },
    });
};

export const useInvalidateOrgAuthProvidersQuery = (organizationId: string) => {
    const queryClient = useQueryClient();

    return useCallback(() => {
        queryClient.invalidateQueries({ queryKey: getOrgAuthProvidersQueryKey(organizationId) });
    }, [organizationId, queryClient]);
};

export const getOrgAuthProvidersQueryKey = (organizationId: string) => ["auth-providers", { organizationId }];
