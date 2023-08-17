/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useCurrentUser } from "../../user-context";

type UseProviderRepositoriesQueryArgs = {
    provider: string;
    installationId?: string;
};
export const useProviderRepositoriesForUser = ({ provider, installationId }: UseProviderRepositoriesQueryArgs) => {
    const user = useCurrentUser();

    return useQuery(
        ["provider-repositories", { userId: user?.id }, { provider, installationId }],
        async () => {
            return await getGitpodService().server.getProviderRepositoriesForUser({
                provider,
                hints: { installationId },
            });
        },
        {
            enabled: !!provider,
        },
    );
};
