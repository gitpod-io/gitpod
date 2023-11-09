/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceContext } from "@gitpod/gitpod-protocol";
import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { StartWorkspaceError } from "../../start/StartPage";

export function useWorkspaceContext(contextUrl?: string) {
    const query = useQuery<WorkspaceContext | null, StartWorkspaceError>(["workspace-context", contextUrl], () => {
        if (!contextUrl) {
            return null;
        }
        return getGitpodService().server.resolveContext(contextUrl);
    });
    return query;
}
