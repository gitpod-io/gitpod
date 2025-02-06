/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { installationClient } from "../../service/public-api";

export const useInstallationDefaultWorkspaceImageQuery = () => {
    return useQuery({
        queryKey: ["installation-default-workspace-image"],
        staleTime: 1000 * 60 * 10, // 10 minute
        queryFn: async () => {
            const response = await installationClient.getInstallationWorkspaceDefaultImage({});
            return response.defaultWorkspaceImage;
        },
    });
};
