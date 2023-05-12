/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { GitpodServer } from "@gitpod/gitpod-protocol";
import { useMutation } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useState } from "react";

export const useCreateWorkspaceMutation = () => {
    const [isStarting, setIsStarting] = useState(false);
    const mutation = useMutation({
        mutationFn: async (options: GitpodServer.CreateWorkspaceOptions) => {
            return await getGitpodService().server.createWorkspace(options);
        },
        onMutate: async (options: GitpodServer.CreateWorkspaceOptions) => {
            setIsStarting(true);
        },
        onError: (error) => {
            console.error(error);
            setIsStarting(false);
        },
        onSuccess: (result) => {
            if (result && result.createdWorkspaceId) {
                // successfully started a workspace, wait a bit before we allow to start another one
                setTimeout(() => {
                    setIsStarting(false);
                }, 4000);
            } else {
                setIsStarting(false);
            }
        },
    });
    return {
        createWorkspace: (options: GitpodServer.CreateWorkspaceOptions) => {
            return mutation.mutateAsync(options);
        },
        isStarting,
        error: mutation.error,
        reset: mutation.reset,
    };
};
