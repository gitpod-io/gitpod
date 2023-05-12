/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { oidcService } from "../../service/public-api";
import { useCurrentOrg } from "../organizations/orgs-query";
import { getOIDCClientsQueryKey } from "./oidc-clients-query";
import { SetClientConfigActivationResponse } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";

type ActivateOIDCClientArgs = {
    id: string;
};
export const useActivateOIDCClientMutation = () => {
    const client = useQueryClient();
    const { data: org } = useCurrentOrg();

    return useMutation<SetClientConfigActivationResponse, Error, ActivateOIDCClientArgs>({
        mutationFn: async ({ id }) => {
            if (!org) {
                throw new Error("No current organization selected");
            }

            return await oidcService.setClientConfigActivation({ id, organizationId: org.id, activate: true });
        },
        onSuccess: () => {
            if (!org) {
                return;
            }

            client.invalidateQueries(getOIDCClientsQueryKey(org.id));
        },
    });
};
