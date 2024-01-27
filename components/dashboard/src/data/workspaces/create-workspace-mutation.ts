/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { workspaceClient } from "../../service/public-api";
import {
    CreateAndStartWorkspaceRequest,
    CreateAndStartWorkspaceResponse,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { PartialMessage } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";

export const useCreateWorkspaceMutation = () => {
    const [isStarting, setIsStarting] = useState(false);
    const mutation = useMutation<
        CreateAndStartWorkspaceResponse,
        ConnectError,
        PartialMessage<CreateAndStartWorkspaceRequest>
    >({
        mutationFn: async (options) => {
            return await workspaceClient.createAndStartWorkspace(options);
        },
        onMutate: async (options: PartialMessage<CreateAndStartWorkspaceRequest>) => {
            setIsStarting(true);
        },
        onError: (error) => {
            setIsStarting(false);
        },
        onSuccess: (result) => {
            if (result.workspace?.id) {
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
        createWorkspace: (options: PartialMessage<CreateAndStartWorkspaceRequest>) => {
            return mutation.mutateAsync(options);
        },
        // Can we use mutation.isLoading here instead?
        isStarting,
        error: mutation.error,
        reset: mutation.reset,
    };
};
