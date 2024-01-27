/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { useUpdateWorkspaceInCache } from "./list-workspaces-query";
import { UpdateWorkspaceRequest } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { PartialMessage } from "@bufbuild/protobuf";
import { workspaceClient } from "../../service/public-api";

export const useUpdateWorkspaceMutation = () => {
    const updateWorkspace = useUpdateWorkspaceInCache();

    return useMutation({
        mutationFn: async (data: PartialMessage<UpdateWorkspaceRequest>) => {
            return await workspaceClient.updateWorkspace(data);
        },
        onSuccess: (data) => {
            if (data.workspace) {
                updateWorkspace(data.workspace);
            }
        },
    });
};
