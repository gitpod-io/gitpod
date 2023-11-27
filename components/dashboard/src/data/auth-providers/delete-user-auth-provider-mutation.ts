/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authProviderClient } from "../../service/public-api";
import { AuthProvider, DeleteAuthProviderRequest } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { getUserAuthProvidersQueryKey } from "./user-auth-providers-query";
import { useAuthenticatedUser } from "../current-user/authenticated-user-query";

type DeleteAuthProviderArgs = {
    providerId: string;
};
export const useDeleteUserAuthProviderMutation = () => {
    const queryClient = useQueryClient();
    const { data: user } = useAuthenticatedUser();

    return useMutation({
        mutationFn: async ({ providerId }: DeleteAuthProviderArgs) => {
            if (!user) {
                throw new Error("No current user");
            }

            const response = await authProviderClient.deleteAuthProvider(
                new DeleteAuthProviderRequest({
                    authProviderId: providerId,
                }),
            );

            return response;
        },
        onSuccess: (_, { providerId }) => {
            if (!user) {
                throw new Error("No current user");
            }

            const queryKey = getUserAuthProvidersQueryKey(user.id);
            queryClient.setQueryData<AuthProvider[]>(queryKey, (providers) => {
                return providers?.filter((p) => p.id !== providerId);
            });

            queryClient.invalidateQueries({ queryKey });
        },
    });
};
