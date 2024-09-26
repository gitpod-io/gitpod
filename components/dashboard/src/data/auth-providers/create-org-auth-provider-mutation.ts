/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getOrgAuthProvidersQueryKey } from "./org-auth-providers-query";
import { CreateAuthProviderRequest } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { authProviderClient } from "../../service/public-api";

type CreateAuthProviderArgs = {
    provider: Pick<CreateAuthProviderRequest, "host" | "type"> & {
        clientId: string;
        clientSecret: string;
        orgId: string;
        authorizationUrl?: string;
        tokenUrl?: string;
    };
};
export const useCreateOrgAuthProviderMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ provider }: CreateAuthProviderArgs) => {
            const response = await authProviderClient.createAuthProvider(
                new CreateAuthProviderRequest({
                    owner: { case: "organizationId", value: provider.orgId },
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
            const orgId = provider?.owner?.value;
            if (!orgId) {
                return;
            }

            queryClient.invalidateQueries({ queryKey: getOrgAuthProvidersQueryKey(orgId) });
        },
    });
};
