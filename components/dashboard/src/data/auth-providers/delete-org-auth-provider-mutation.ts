/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { getOrgAuthProvidersQueryKey, OrgAuthProvidersQueryResult } from "./org-auth-providers-query";
import { authProviderClient } from "../../service/public-api";
import { DeleteAuthProviderRequest } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";

type DeleteAuthProviderArgs = {
    providerId: string;
};
export const useDeleteOrgAuthProviderMutation = () => {
    const queryClient = useQueryClient();
    const organization = useCurrentOrg().data;

    return useMutation({
        mutationFn: async ({ providerId }: DeleteAuthProviderArgs) => {
            if (!organization) {
                throw new Error("No current organization selected");
            }

            const response = await authProviderClient.deleteAuthProvider(
                new DeleteAuthProviderRequest({
                    authProviderId: providerId,
                }),
            );

            return response;
        },
        onSuccess: (_, { providerId }) => {
            if (!organization) {
                throw new Error("No current organization selected");
            }

            const queryKey = getOrgAuthProvidersQueryKey(organization.id);
            queryClient.setQueryData<OrgAuthProvidersQueryResult>(queryKey, (providers) => {
                return providers?.filter((p) => p.id !== providerId);
            });

            queryClient.invalidateQueries({ queryKey });
        },
    });
};
