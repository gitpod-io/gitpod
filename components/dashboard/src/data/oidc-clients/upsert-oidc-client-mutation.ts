/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { oidcService } from "../../service/public-api";
import { getOIDCClientsQueryKey } from "./oidc-clients-query";
import {
    CreateClientConfigResponse,
    UpdateClientConfigResponse,
} from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";

// TODO: find a better way to type this against the API
type UpsertOIDCClientMutationArgs =
    | Parameters<typeof oidcService.updateClientConfig>[0]
    | Parameters<typeof oidcService.createClientConfig>[0];

export const useUpsertOIDCClientMutation = () => {
    const queryClient = useQueryClient();

    return useMutation<CreateClientConfigResponse | UpdateClientConfigResponse, Error, UpsertOIDCClientMutationArgs>({
        mutationFn: async ({ config = {} }: UpsertOIDCClientMutationArgs) => {
            if ("id" in config) {
                return await oidcService.updateClientConfig({
                    config,
                });
            } else {
                return await oidcService.createClientConfig({
                    config,
                });
            }
        },
        onSuccess(resp, { config = {} }) {
            if (!config || !config.organizationId) {
                return;
            }

            queryClient.invalidateQueries({ queryKey: getOIDCClientsQueryKey(config.organizationId || "") });
        },
    });
};
