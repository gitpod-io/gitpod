/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrganizationEnvironmentVariable } from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import { envVarClient } from "../../service/public-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const getListOrgEnvVarQueryKey = (orgId: string) => {
    const key: any[] = ["organization", orgId, "envvar", "list"];

    return key;
};

const getOrgEnvVarQueryKey = (orgId: string, variableId: string) => {
    const key: any[] = ["organization", orgId, "envvar", { variableId }];

    return key;
};

export const useListOrganizationEnvironmentVariables = (orgId: string) => {
    return useQuery<OrganizationEnvironmentVariable[]>(getListOrgEnvVarQueryKey(orgId), {
        queryFn: async () => {
            const { environmentVariables } = await envVarClient.listOrganizationEnvironmentVariables({
                organizationId: orgId,
            });

            return environmentVariables;
        },
        cacheTime: 1000 * 60 * 60 * 24, // one day
    });
};

type DeleteEnvironmentVariableArgs = {
    variableId: string;
    organizationId: string;
};
export const useDeleteOrganizationEnvironmentVariable = () => {
    const queryClient = useQueryClient();

    return useMutation<void, Error, DeleteEnvironmentVariableArgs>({
        mutationFn: async ({ variableId }) => {
            void (await envVarClient.deleteOrganizationEnvironmentVariable({
                environmentVariableId: variableId,
            }));
        },
        onSuccess: (_, { organizationId, variableId }) => {
            queryClient.invalidateQueries({ queryKey: getListOrgEnvVarQueryKey(organizationId) });
            queryClient.invalidateQueries({ queryKey: getOrgEnvVarQueryKey(organizationId, variableId) });
        },
    });
};

type CreateEnvironmentVariableArgs = {
    organizationId: string;
    name: string;
    value: string;
};
export const useCreateOrganizationEnvironmentVariable = () => {
    const queryClient = useQueryClient();

    return useMutation<OrganizationEnvironmentVariable, Error, CreateEnvironmentVariableArgs>({
        mutationFn: async ({ organizationId, name, value }) => {
            const { environmentVariable } = await envVarClient.createOrganizationEnvironmentVariable({
                organizationId,
                name,
                value,
            });
            if (!environmentVariable) {
                throw new Error("Failed to create environment variable");
            }

            return environmentVariable;
        },
        onSuccess: (_, { organizationId }) => {
            queryClient.invalidateQueries({ queryKey: getListOrgEnvVarQueryKey(organizationId) });
        },
    });
};

type UpdateEnvironmentVariableArgs = CreateEnvironmentVariableArgs & {
    variableId: string;
};
export const useUpdateOrganizationEnvironmentVariable = () => {
    const queryClient = useQueryClient();

    return useMutation<OrganizationEnvironmentVariable, Error, UpdateEnvironmentVariableArgs>({
        mutationFn: async ({ variableId, name, value, organizationId }: UpdateEnvironmentVariableArgs) => {
            const { environmentVariable } = await envVarClient.updateOrganizationEnvironmentVariable({
                environmentVariableId: variableId,
                organizationId,
                name,
                value,
            });
            if (!environmentVariable) {
                throw new Error("Failed to update environment variable");
            }

            return environmentVariable;
        },
        onSuccess: (_, { organizationId, variableId }) => {
            queryClient.invalidateQueries({ queryKey: getListOrgEnvVarQueryKey(organizationId) });
            queryClient.invalidateQueries({ queryKey: getOrgEnvVarQueryKey(organizationId, variableId) });
        },
    });
};
