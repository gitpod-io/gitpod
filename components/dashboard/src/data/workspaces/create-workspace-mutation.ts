/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { GitpodServer } from "@gitpod/gitpod-protocol";
import { useMutation } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";

export const useCreateWorkspaceMutation = () => {
    return useMutation({
        mutationFn: async (options: GitpodServer.CreateWorkspaceOptions) => {
            return await getGitpodService().server.createWorkspace(options);
        },
    });
};
