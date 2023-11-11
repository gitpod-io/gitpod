/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { configurationClient } from "../../service/public-api";
import { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";

const BASE_KEY = "configurations";

type ListConfigurationsArgs = {
    searchTerm?: string;
    page: number;
    pageSize: number;
};

export const useListConfigurations = ({ searchTerm = "", page, pageSize }: ListConfigurationsArgs) => {
    const { data: org } = useCurrentOrg();

    return useQuery(
        getListConfigurationsQueryKey(org?.id || "", { searchTerm, page, pageSize }),
        async () => {
            if (!org) {
                throw new Error("No org currently selected");
            }

            const { configurations, pagination } = await configurationClient.listConfigurations({
                organizationId: org.id,
                searchTerm,
                pagination: { page, pageSize },
            });

            return { configurations, pagination };
        },
        {
            enabled: !!org,
        },
    );
};

export const getListConfigurationsQueryKey = (orgId: string, args?: ListConfigurationsArgs) => {
    const key: any[] = [BASE_KEY, "list", { orgId }];
    if (args) {
        key.push(args);
    }

    return key;
};

export const useConfiguration = (configurationId: string) => {
    return useQuery<Configuration | undefined, Error>(getConfigurationQueryKey(configurationId), async () => {
        const { configuration } = await configurationClient.getConfiguration({
            configurationId,
        });

        return configuration;
    });
};

export const getConfigurationQueryKey = (configurationId: string) => {
    const key: any[] = [BASE_KEY, { configurationId }];

    return key;
};
