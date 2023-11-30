/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { authProviderClient } from "../../service/public-api";
import { AuthProvider, ListAuthProvidersRequest } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { useAuthenticatedUser } from "../current-user/authenticated-user-query";

export type OrgAuthProvidersQueryResult = AuthProvider[];
export const useOrgAuthProvidersQuery = () => {
    const { user } = useAuthenticatedUser();

    return useQuery<OrgAuthProvidersQueryResult>({
        queryKey: getUserAuthProvidersQueryKey(user?.id ?? ""),
        queryFn: async () => {
            if (!user) {
                throw new Error("No user");
            }

            const response = await authProviderClient.listAuthProviders(
                new ListAuthProvidersRequest({
                    id: {
                        case: "userId",
                        value: user.id,
                    },
                }),
            );

            return response.authProviders;
        },
        enabled: !!user,
    });
};

export const getUserAuthProvidersQueryKey = (userId: string) => ["user-auth-providers", { userId }];
