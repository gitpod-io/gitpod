/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";

export const useDefaultWorkspaceImageQuery = () => {
    return useQuery<string>({
        queryKey: ["default-workspace-image"],
        staleTime: 1000 * 60 * 10, // 10 minute
        queryFn: async () => {
            const image = await getGitpodService().server.getDefaultWorkspaceImage();
            return image;
        },
    });
};
