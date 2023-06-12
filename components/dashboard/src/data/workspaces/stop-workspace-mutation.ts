/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { workspacesService } from "../../service/public-api";
import { getGitpodService } from "../../service/service";
import { useFeatureFlag } from "../featureflag-query";

type StopWorkspaceArgs = {
    workspaceId: string;
};

export const useStopWorkspaceMutation = () => {
    const usePublicApiWorkspacesService = useFeatureFlag("publicApiExperimentalWorkspaceService");

    // No need to manually update workspace in cache here, we'll receive messages over the ws that will update it
    return useMutation({
        mutationFn: async ({ workspaceId }: StopWorkspaceArgs) => {
            usePublicApiWorkspacesService
                ? workspacesService.stopWorkspace({ workspaceId })
                : getGitpodService().server.stopWorkspace(workspaceId);
        },
    });
};
