/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { configurationClient } from "../../service/public-api";
import type { Configuration, UpdateConfigurationRequest } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import type { PartialMessage } from "@bufbuild/protobuf";
import { useStateWithDebounce } from "../../hooks/use-state-with-debounce";
import { useEffect } from "react";

const BASE_KEY = "configurations";

type ListConfigurationsArgs = {
    pageSize?: number;
    searchTerm?: string;
};

export const useListConfigurations = ({ searchTerm = "", pageSize }: ListConfigurationsArgs) => {
    const { data: org } = useCurrentOrg();

    return useInfiniteQuery(
        getListConfigurationsQueryKey(org?.id || "", { searchTerm, pageSize }),
        // QueryFn receives the past page's pageParam as it's argument
        async ({ pageParam: nextToken }) => {
            if (!org) {
                throw new Error("No org currently selected");
            }

            const { configurations, pagination } = await configurationClient.listConfigurations({
                organizationId: org.id,
                searchTerm,
                pagination: { pageSize, token: nextToken },
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
