/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { GetDefaultWorkspaceImageResult } from "@gitpod/gitpod-protocol";

export const useDefaultWorkspaceImageQuery = (workspaceId?: string) => {
    return useQuery<GetDefaultWorkspaceImageResult>({
        queryKey: ["default-workspace-image", { workspaceId }],
        staleTime: 1000 * 60 * 10, // 10 minute
        queryFn: async () => {
            return await getGitpodService().server.getDefaultWorkspaceImage({ workspaceId });
        },
    });
};
