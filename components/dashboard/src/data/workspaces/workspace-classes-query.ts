/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SupportedWorkspaceClass } from "@gitpod/gitpod-protocol/lib/workspace-class";
import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";

export const DEFAULT_WS_CLASS = "g1-standard";

export const useWorkspaceClasses = () => {
    return useQuery<SupportedWorkspaceClass[]>({
        queryKey: ["workspace-classes"],
        queryFn: async () => {
            return getGitpodService().server.getSupportedWorkspaceClasses();
        },
        cacheTime: 1000 * 60 * 60, // 1h
        staleTime: 1000 * 60 * 60, // 1h
    });
};
