/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";

export const useAuthProviders = () => {
    return useQuery<AuthProviderInfo[]>({
        queryKey: ["auth-providers"],
        queryFn: async () => {
            return await getGitpodService().server.getAuthProviders();
        },
    });
};
