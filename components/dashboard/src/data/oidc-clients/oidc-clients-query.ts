/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";
import { useQuery } from "@tanstack/react-query";
import { oidcService } from "../../service/public-api";
import { useCurrentOrg } from "../organizations/orgs-query";

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
        enabled: !isLoading,
    });
};

export const getOIDCClientsQueryKey = (organizationId: string) => ["oidc-clients", { organizationId }];
