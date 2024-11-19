/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreateAuthProviderRequest } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { authProviderClient } from "../../service/public-api";
import { getUserAuthProvidersQueryKey } from "./user-auth-providers-query";

type CreateAuthProviderArgs = {
    provider: Pick<CreateAuthProviderRequest, "host" | "type"> & {
        clientId: string;
        clientSecret: string;
        userId: string;
        authorizationUrl?: string;
        tokenUrl?: string;
    };
};
export const useCreateUserAuthProviderMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ provider }: CreateAuthProviderArgs) => {
            const response = await authProviderClient.createAuthProvider(
                new CreateAuthProviderRequest({
                    owner: { case: "ownerId", value: provider.userId },
                    host: provider.host,
                    oauth2Config: {
                        clientId: provider.clientId,
                        clientSecret: provider.clientSecret,
                        authorizationUrl: provider.authorizationUrl,
                        tokenUrl: provider.tokenUrl,
                    },
                    type: provider.type,
                }),
            );
            return response.authProvider!;
        },
        onSuccess(provider) {
            const userId = provider?.owner?.value;
            if (!userId) {
                return;
            }

            queryClient.invalidateQueries({ queryKey: getUserAuthProvidersQueryKey(userId) });
        },
    });
};
