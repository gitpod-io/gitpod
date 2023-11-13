/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useCurrentOrg } from "../organizations/orgs-query";
import { authProviderClient } from "../../service/public-api";
import { AuthProvider, ListAuthProvidersRequest } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";

export type OrgAuthProvidersQueryResult = AuthProvider[];
export const useOrgAuthProvidersQuery = () => {
    const organization = useCurrentOrg().data;

    return useQuery<OrgAuthProvidersQueryResult>({
        queryKey: getOrgAuthProvidersQueryKey(organization?.id ?? ""),
        queryFn: async () => {
            if (!organization) {
                throw new Error("No current organization selected");
            }

            const response = await authProviderClient.listAuthProviders(
                new ListAuthProvidersRequest({
                    id: {
                        case: "organizationId",
                        value: organization.id,
                    },
                }),
            );

            return response.authProviders;
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
