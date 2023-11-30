/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { configurationClient } from "../../service/public-api";
import { SortOrder } from "@gitpod/public-api/lib/gitpod/v1/sorting_pb";
import { TableSortOrder } from "@podkit/tables/SortableTable";
import type { Configuration, UpdateConfigurationRequest } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import type { PartialMessage } from "@bufbuild/protobuf";
import { envVarClient } from "../../service/public-api";
import type {
    ConfigurationEnvironmentVariable,
    EnvironmentVariableAdmission,
} from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";

const BASE_KEY = "configurations";

type ListConfigurationsArgs = {
    pageSize?: number;
    searchTerm?: string;
    sortBy: string;
    sortOrder: TableSortOrder;
};

export const useListConfigurations = ({ searchTerm = "", pageSize, sortBy, sortOrder }: ListConfigurationsArgs) => {
    const { data: org } = useCurrentOrg();

    return useInfiniteQuery(
        getListConfigurationsQueryKey(org?.id || "", { searchTerm, pageSize, sortBy, sortOrder }),
        // QueryFn receives the past page's pageParam as it's argument
        async ({ pageParam: nextToken }) => {
            if (!org) {
                throw new Error("No org currently selected");
            }

            const { configurations, pagination } = await configurationClient.listConfigurations({
                organizationId: org.id,
                searchTerm,
                pagination: { pageSize, token: nextToken },
                sort: [
                    {
                        field: sortBy,
                        order: sortOrder === "desc" ? SortOrder.DESC : SortOrder.ASC,
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
            // This enables the query to know if there are more pages, and passes the last page's nextToken to the queryFn
            getNextPageParam: (lastPage) => {
                // Must ensure we return undefined if there are no more pages
                return lastPage.pagination?.nextToken || undefined;
            },
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

export const getListConfigurationsVariablesQueryKey = (configurationId: string) => {
    return [BASE_KEY, "variable", "list", { configurationId }];
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
            // todo: look into updating the cache instead of invalidating it
            queryClient.invalidateQueries({ queryKey: ["configurations", "list"] });
            queryClient.invalidateQueries({ queryKey: getConfigurationQueryKey(configurationId) });
        },
    });
};

export type PartialConfiguration = PartialMessage<UpdateConfigurationRequest> &
    Pick<UpdateConfigurationRequest, "configurationId">;

export const useConfigurationMutation = () => {
    const queryClient = useQueryClient();

    return useMutation<Configuration, Error, PartialConfiguration>({
        mutationFn: async (configuration) => {
            const updated = await configurationClient.updateConfiguration({
                configurationId: configuration.configurationId,
                name: configuration.name,
                workspaceSettings: configuration.workspaceSettings,
                prebuildSettings: configuration.prebuildSettings,
            });

            if (!updated.configuration) {
                throw new Error("Failed to update configuration");
            }

            queryClient.invalidateQueries({ queryKey: ["configurations", "list"] });
            queryClient.invalidateQueries({ queryKey: getConfigurationQueryKey(configuration.configurationId) });

            return updated.configuration;
        },
    });
};

export const getConfigurationQueryKey = (configurationId: string) => {
    const key: any[] = [BASE_KEY, { configurationId }];

    return key;
};

export const getConfigurationVariableQueryKey = (variableId: string) => {
    const key: any[] = [BASE_KEY, "variable", { configurationId: variableId }];

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

export const useListConfigurationVariables = (configurationId: string) => {
    return useQuery<ConfigurationEnvironmentVariable[]>(getListConfigurationsVariablesQueryKey(configurationId), {
        queryFn: async () => {
            const { environmentVariables } = await envVarClient.listConfigurationEnvironmentVariables({
                configurationId,
            });
            return environmentVariables;
        },
        cacheTime: 1000 * 60 * 60 * 24, // one day
    });
};

type DeleteVariableArgs = {
    variableId: string;
    configurationId: string;
};
export const useDeleteConfigurationVariable = () => {
    const queryClient = useQueryClient();

    return useMutation<void, Error, DeleteVariableArgs>({
        mutationFn: async ({ variableId }) => {
            void (await envVarClient.deleteConfigurationEnvironmentVariable({
                environmentVariableId: variableId,
            }));
            return;
        },
        onSuccess: (_, { configurationId, variableId }) => {
            queryClient.invalidateQueries({ queryKey: getListConfigurationsVariablesQueryKey(configurationId) });
            queryClient.invalidateQueries({ queryKey: getConfigurationVariableQueryKey(variableId) });
        },
    });
};

type CreateVariableArgs = {
    configurationId: string;
    name: string;
    value: string;
    admission: EnvironmentVariableAdmission;
};
export const useCreateConfigurationVariable = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ configurationId, name, value, admission }: CreateVariableArgs) => {
            return await envVarClient.createConfigurationEnvironmentVariable({
                configurationId,
                name,
                value,
                admission,
            });
        },
        onSuccess: (_, { configurationId }) => {
            queryClient.invalidateQueries({ queryKey: getListConfigurationsVariablesQueryKey(configurationId) });
        },
    });
};

type UpdateVariableArgs = CreateVariableArgs & {
    variableId: string;
};
export const useUpdateConfigurationVariable = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ variableId, name, value, admission }: UpdateVariableArgs) => {
            return await envVarClient.updateConfigurationEnvironmentVariable({
                environmentVariableId: variableId,
                name,
                value,
                admission,
            });
        },
        onSuccess: (_, { configurationId, variableId }) => {
            queryClient.invalidateQueries({ queryKey: getListConfigurationsVariablesQueryKey(configurationId) });
            queryClient.invalidateQueries({ queryKey: getConfigurationVariableQueryKey(variableId) });
        },
    });
};
