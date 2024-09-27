/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getOrgAuthProvidersQueryKey } from "./org-auth-providers-query";
import { UpdateAuthProviderRequest } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { authProviderClient } from "../../service/public-api";

type UpdateAuthProviderArgs = {
    provider: {
        id: string;
        clientId: string;
        clientSecret: string;
        authorizationUrl?: string;
        tokenUrl?: string;
    };
};
export const useUpdateOrgAuthProviderMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ provider }: UpdateAuthProviderArgs) => {
            const response = await authProviderClient.updateAuthProvider(
                new UpdateAuthProviderRequest({
                    authProviderId: provider.id,
                    clientId: provider.clientId,
                    clientSecret: provider.clientSecret,
                    authorizationUrl: provider.authorizationUrl,
                    tokenUrl: provider.tokenUrl,
                }),
            );
            return response.authProvider!;
        },
        onSuccess(provider) {
            const orgId = provider?.owner?.value;
            if (!orgId) {
                return;
            }

            queryClient.invalidateQueries({ queryKey: getOrgAuthProvidersQueryKey(orgId) });
        },
    });
};
