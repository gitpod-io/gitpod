/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { authProviderClient } from "../../service/public-api";
import {
    AuthProviderDescription,
    ListAuthProviderDescriptionsRequest,
} from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { useAuthenticatedUser } from "../current-user/authenticated-user-query";

export const useAuthProviderDescriptions = () => {
    const { user } = useAuthenticatedUser();
    const query = useQuery<AuthProviderDescription[]>({
        queryKey: getAuthProviderDescriptionsQueryKey(),
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

export const getAuthProviderDescriptionsQueryKey = () => ["auth-provider-descriptions", {}];
