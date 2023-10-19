/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";

type SetProjectEnvVarArgs = {
    projectId: string;
    name: string;
    value: string;
    censored: boolean;
};
export const useSetProjectEnvVar = () => {
    const client = useQueryClient();

    return useMutation<void, Error, SetProjectEnvVarArgs>(async ({ projectId, name, value, censored }) => {
        await getGitpodService().server.setProjectEnvironmentVariable(projectId, name, value, censored);

        // Invalidate env var list queries
        client.invalidateQueries(getListProjectEnvVarsQueryKey(projectId));
    });
};

export const useListProjectEnvironmentVariables = (id: string) => {
    return useQuery(
        getListProjectEnvVarsQueryKey(id),
        async () => {
            const vars = await getGitpodService().server.getProjectEnvironmentVariables(id);
            const sortedVars = vars.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));
            return sortedVars;
        },
        {
            enabled: !!id,
        },
    );
};

export const useDeleteProjectEnvironmentVariable = (projectId: string) => {
    const client = useQueryClient();

    return useMutation<void, Error, string>(async (variableId: string) => {
        await getGitpodService().server.deleteProjectEnvironmentVariable(variableId);

        // Invalidate env var list queries
        client.invalidateQueries(getListProjectEnvVarsQueryKey(projectId));
    });
};

const BASE_KEY = "projects";

export const getListProjectEnvVarsQueryKey = (projectId: string) => {
    const key: any[] = [BASE_KEY, "env-vars", { projectId }];

    return key;
};
