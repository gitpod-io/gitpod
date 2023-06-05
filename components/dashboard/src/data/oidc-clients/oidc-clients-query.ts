/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { oidcService } from "../../service/public-api";
import { useCurrentOrg } from "../organizations/orgs-query";
import { useCallback } from "react";

export type OIDCClientsQueryResults = OIDCClientConfig[];

export const useOIDCClientsQuery = () => {
    const { data: organization, isLoading } = useCurrentOrg();

    return useQuery<OIDCClientsQueryResults>({
        queryKey: getOIDCClientsQueryKey(organization?.id ?? ""),
        queryFn: async () => {
            if (!organization) {
                throw new Error("No current organization selected");
            }

            const { clientConfigs } = await oidcService.listClientConfigs({ organizationId: organization.id });

            return clientConfigs;
        },
        enabled: !isLoading && !!organization,
    });
};

export const useInvalidateOIDCClientsQuery = () => {
    const client = useQueryClient();
    const { data: organization } = useCurrentOrg();

    return useCallback(() => {
        if (!organization) {
            throw new Error("No current organization selected");
        }

        client.invalidateQueries(getOIDCClientsQueryKey(organization.id));
    }, [client, organization]);
};

export const getOIDCClientsQueryKey = (organizationId: string) => ["oidc-clients", { organizationId }];
