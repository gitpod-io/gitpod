/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { oidcService } from "../../service/public-api";
import { useCurrentOrg } from "../organizations/orgs-query";
import { getOIDCClientsQueryKey, OIDCClientsQueryResults } from "./oidc-clients-query";

type DeleteOIDCClientArgs = {
    clientId: string;
};
export const useDeleteOIDCClientMutation = () => {
    const queryClient = useQueryClient();
    const organization = useCurrentOrg().data;

    return useMutation({
        mutationFn: async ({ clientId }: DeleteOIDCClientArgs) => {
            if (!organization) {
                throw new Error("No current organization selected");
            }

            return await oidcService.deleteClientConfig({
                id: clientId,
                organizationId: organization.id,
            });
        },
        onSuccess: (_, { clientId }) => {
            if (!organization) {
                throw new Error("No current organization selected");
            }

            const queryKey = getOIDCClientsQueryKey(organization.id);
            // filter out deleted client immediately
            queryClient.setQueryData<OIDCClientsQueryResults>(queryKey, (clients) => {
                return clients?.filter((c) => c.id !== clientId);
            });

            // then invalidate query
            queryClient.invalidateQueries({ queryKey });
        },
    });
};
