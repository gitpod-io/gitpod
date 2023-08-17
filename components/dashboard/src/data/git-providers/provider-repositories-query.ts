/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useCurrentUser } from "../../user-context";
import { CancellationTokenSource } from "vscode-jsonrpc";

type UseProviderRepositoriesQueryArgs = {
    provider: string;
    installationId?: string;
};
export const useProviderRepositoriesForUser = ({ provider, installationId }: UseProviderRepositoriesQueryArgs) => {
    const user = useCurrentUser();

    return useQuery(
        ["provider-repositories", { userId: user?.id }, { provider, installationId }],
        async ({ signal }) => {
            // jsonrpc cancellation token that we subscribe to the abort signal provided by react-query
            const cancelToken = new CancellationTokenSource();

            signal?.addEventListener("abort", () => {
                cancelToken.cancel();
            });

            return await getGitpodService().server.getProviderRepositoriesForUser(
                {
                    provider,
                    hints: { installationId },
                },
                // @ts-ignore - not sure why types don't support this
                cancelToken.token,
            );
        },
        {
            enabled: !!provider,
        },
    );
};
