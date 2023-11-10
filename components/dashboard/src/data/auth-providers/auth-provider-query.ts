/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { authProviderClient } from "../../service/public-api";
import { useCurrentUser } from "../../user-context";
import {
    AuthProviderDescription,
    ListAuthProviderDescriptionsRequest,
} from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";

export const useAuthProviders = () => {
    return useQuery<AuthProviderInfo[]>({
        queryKey: ["auth-providers"],
        queryFn: async () => {
            return await getGitpodService().server.getAuthProviders();
        },
    });
};

export const useAuthProviderDescriptions = () => {
    const user = useCurrentUser();
    const query = useQuery<AuthProviderDescription[]>({
        queryKey: ["auth-provider-descriptions"],
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
