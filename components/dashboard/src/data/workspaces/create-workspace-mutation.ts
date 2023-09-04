/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { GitpodServer, WorkspaceCreationResult } from "@gitpod/gitpod-protocol";
import { useMutation } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useState } from "react";
import { StartWorkspaceError } from "../../start/StartPage";

export const useCreateWorkspaceMutation = () => {
    const [isStarting, setIsStarting] = useState(false);
    const mutation = useMutation<WorkspaceCreationResult, StartWorkspaceError, GitpodServer.CreateWorkspaceOptions>({
        mutationFn: async (options) => {
            return await getGitpodService().server.createWorkspace(options);
        },
        onMutate: async (options: GitpodServer.CreateWorkspaceOptions) => {
            setIsStarting(true);
        },
        onError: (error) => {
            setIsStarting(false);
        },
    });
    return {
        createWorkspace: (options: GitpodServer.CreateWorkspaceOptions) => {
            return mutation.mutateAsync(options);
        },
        // Can we use mutation.isLoading here instead?
        isStarting,
        error: mutation.error,
        reset: mutation.reset,
    };
};
