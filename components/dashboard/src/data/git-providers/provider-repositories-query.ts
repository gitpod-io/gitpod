/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useCurrentUser } from "../../user-context";
import { CancellationTokenSource } from "vscode-jsonrpc";
import { useAuthProviders } from "../auth-providers/auth-provider-query";
import { GetProviderRepositoriesParams } from "@gitpod/gitpod-protocol";
import { useFeatureFlag } from "../featureflag-query";

type UseProviderRepositoriesQueryArgs = {
    providerHost: string;
    installationId?: string;
    search?: string;
    enabled?: boolean;
};
export const useProviderRepositoriesForUser = ({
    providerHost,
    installationId,
    search,
    enabled = true,
}: UseProviderRepositoriesQueryArgs) => {
    const user = useCurrentUser();
    const newProjectIncrementalRepoSearchBBS = useFeatureFlag("newProjectIncrementalRepoSearchBBS");
    const { data: authProviders } = useAuthProviders();
    const selectedProvider = authProviders?.find((p) => p.host === providerHost);

    const queryKey: any[] = ["provider-repositories", { userId: user?.id }, { providerHost, installationId }];

    const isBitbucketServer = selectedProvider?.authProviderType === "BitbucketServer";
    const enableIncrementalSearch = isBitbucketServer && newProjectIncrementalRepoSearchBBS;
    if (enableIncrementalSearch) {
        queryKey.push({ search });
    }

    return useQuery(
        queryKey,
        async ({ signal }) => {
            // jsonrpc cancellation token that we subscribe to the abort signal provided by react-query
            const cancelToken = new CancellationTokenSource();

            signal?.addEventListener("abort", () => {
                cancelToken.cancel();
            });

            const params: GetProviderRepositoriesParams = {
                provider: providerHost,
                hints: { installationId },
            };

            // TODO: Have this be the default for all provider types
            if (enableIncrementalSearch) {
                params.searchString = search;
                params.limit = 50;
                params.maxPages = 1;
            }

            return await getGitpodService().server.getProviderRepositoriesForUser(
                params,
                // @ts-ignore - not sure why types don't support this
                cancelToken.token,
            );
        },
        {
            enabled: enabled && !!providerHost,
        },
    );
};
