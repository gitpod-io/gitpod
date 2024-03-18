/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { authProviderClient } from "../../service/public-api";
import { useCurrentUser } from "../../user-context";
import {
    AuthProviderDescription,
    ListAuthProviderDescriptionsRequest,
} from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";

export const useAuthProviderDescriptions = () => {
    const user = useCurrentUser();
    const query = useQuery<AuthProviderDescription[]>({
        queryKey: getAuthProviderDescriptionsQueryKey(user?.id),
        queryFn: async () => {
            const params = new ListAuthProviderDescriptionsRequest();
            if (user) {
                params.id = {
                    case: "userId",
                    value: user.id,
                };
            }
            const response = await authProviderClient.listAuthProviderDescriptions(params);
            return response.descriptions;
        },
    });
    return query;
};

export const getAuthProviderDescriptionsQueryKey = (userId?: string) => ["auth-provider-descriptions", { userId }];
