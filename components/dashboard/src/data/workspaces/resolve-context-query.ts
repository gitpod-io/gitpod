/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { GitInitializer, ParseContextURLResponse } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { workspaceClient } from "../../service/public-api";

export function useWorkspaceContext(contextUrl?: string) {
    const query = useQuery<ParseContextURLResponse | null>(
        ["workspace-context", contextUrl],
        () => {
            if (!contextUrl) {
                return null;
            }
            return workspaceClient.parseContextURL({ contextUrl });
        },
        {
            retry: false,
        },
    );
    return query;
}

export function getCommitInfo(response: ParseContextURLResponse | null) {
    if (!response) {
        return undefined;
    }
    const specs = response.spec?.initializer?.specs;
    if (!specs || specs.length === 0) {
        return undefined;
    }
    const gitInit: GitInitializer | undefined = specs.find((item) => item.spec.case === "git")?.spec.value as any;
    if (!gitInit) {
        return undefined;
    }
    return {
        cloneUrl: gitInit.remoteUri,
        revision: gitInit.revision,
    };
}
