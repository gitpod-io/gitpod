/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { configurationClient } from "../../service/public-api";
import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { SortOrder } from "@gitpod/public-api/lib/gitpod/v1/sorting_pb";

const BASE_KEY = "configurations";

type ListConfigurationsArgs = {
    searchTerm?: string;
    page: number;
    pageSize: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
};

export const useListConfigurations = ({
    searchTerm = "",
    page,
    pageSize,
    sortBy,
    sortOrder,
}: ListConfigurationsArgs) => {
    const { data: org } = useCurrentOrg();

    return useQuery(
        getListConfigurationsQueryKey(org?.id || "", { searchTerm, page, pageSize, sortBy, sortOrder }),
        async () => {
            if (!org) {
                throw new Error("No org currently selected");
            }

            const { configurations, pagination } = await configurationClient.listConfigurations({
                organizationId: org.id,
                searchTerm,
                pagination: { page, pageSize },
                sort: [
                    {
                        field: sortBy,
                        order: sortOrder === "asc" ? SortOrder.ASC : SortOrder.DESC,
                    },
                ],
            });

            return {
                configurations,
                pagination,
            };
        },
        {
            enabled: !!org,
            keepPreviousData: true,
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

type DeleteConfigurationArgs = {
    configurationId: string;
};
export const useDeleteConfiguration = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ configurationId }: DeleteConfigurationArgs) => {
            return await configurationClient.deleteConfiguration({
                configurationId,
            });
        },
        onSuccess: (_, { configurationId }) => {
            queryClient.invalidateQueries({ queryKey: ["configurations", "list"] });
            queryClient.invalidateQueries({ queryKey: getConfigurationQueryKey(configurationId) });
        },
    });
};

export const getConfigurationQueryKey = (configurationId: string) => {
    const key: any[] = [BASE_KEY, { configurationId }];

    return key;
};

export type CreateConfigurationArgs = {
    name: string;
    cloneUrl: string;
};

export const useCreateConfiguration = () => {
    const { data: org } = useCurrentOrg();
    const queryClient = useQueryClient();

    return useMutation<Configuration, Error, CreateConfigurationArgs>({
        mutationFn: async ({ name, cloneUrl }) => {
            if (!org) {
                throw new Error("No org currently selected");
            }

            // TODO: Should we push this into the api?
            // ensure a .git suffix
            const normalizedCloneURL = cloneUrl.endsWith(".git") ? cloneUrl : `${cloneUrl}.git`;

            const response = await configurationClient.createConfiguration({
                name,
                cloneUrl: normalizedCloneURL,
                organizationId: org.id,
            });
            if (!response.configuration) {
                throw new Error("Failed to create configuration");
            }

            return response.configuration;
        },
        onSuccess: (configuration) => {
            queryClient.setQueryData(getConfigurationQueryKey(configuration.id), configuration);
            queryClient.invalidateQueries({ queryKey: ["configurations", "list"] });
        },
    });
};
