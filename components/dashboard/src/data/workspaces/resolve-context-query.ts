/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceContext } from "@gitpod/gitpod-protocol";
import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";

export function useWorkspaceContext(contextUrl?: string) {
    const query = useQuery<WorkspaceContext, Error>(
        ["workspace-context", contextUrl],
        () => {
            if (!contextUrl) {
                throw new Error("no contextURL. Query should be disabled.");
            }
            return getGitpodService().server.resolveContext(contextUrl);
        },
        {
            enabled: !!contextUrl,
        },
    );
    return query;
}
