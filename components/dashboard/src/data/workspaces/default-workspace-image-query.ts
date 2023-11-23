/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { GetDefaultWorkspaceImageResult } from "@gitpod/gitpod-protocol";
import { GetWorkspaceDefaultImageResponse } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { workspaceClient } from "../../service/public-api";

export const useDefaultWorkspaceImageQuery = (workspaceId?: string) => {
    return useQuery<GetDefaultWorkspaceImageResult>({
        queryKey: ["default-workspace-image", { workspaceId }],
        staleTime: 1000 * 60 * 10, // 10 minute
        queryFn: async () => {
            // without `workspaceId` getDefaultWorkspaceImage will return org setting and if not set fallback to installation
            return await getGitpodService().server.getDefaultWorkspaceImage({ workspaceId });
        },
    });
};

export const useWorkspaceDefaultImageQuery = (workspaceId: string) => {
    return useQuery<GetWorkspaceDefaultImageResponse>({
        queryKey: ["default-workspace-image-v2", { workspaceId }],
        staleTime: 1000 * 60 * 10, // 10 minute
        queryFn: async () => {
            return await workspaceClient.getWorkspaceDefaultImage({ workspaceId });
        },
    });
};
