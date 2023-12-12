/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import {
    GitInitializer,
    GitInitializer_CloneTargetMode,
    ParseContextURLResponse,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { workspaceClient } from "../../service/public-api";

export function useWorkspaceContext(contextUrl?: string) {
    const query = useQuery<{
        data: ParseContextURLResponse;
        refererIDE?: string;
        cloneUrl?: string;
        revision?: string;
    } | null>(
        ["workspace-context", contextUrl],
        async () => {
            if (!contextUrl) {
                return null;
            }
            const data = await workspaceClient.parseContextURL({ contextUrl });
            const commitInfo = getCommitInfo(data);
            return {
                data,
                refererIDE: matchRefererIDE(contextUrl),
                cloneUrl: commitInfo?.cloneUrl,
                revision: commitInfo?.revision,
            };
        },
        {
            retry: false,
        },
    );
    return query;
}

// TODO: Compatible code, remove me
function getCommitInfo(response: ParseContextURLResponse | null) {
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
    const result: { cloneUrl: string; revision?: string } = { cloneUrl: gitInit.remoteUri };
    if (gitInit.targetMode === GitInitializer_CloneTargetMode.REMOTE_BRANCH) {
        result.revision = gitInit.cloneTarget;
    }
    return result;
}

// TODO: Compatible code, remove me
function matchRefererIDE(url: string) {
    const regex = /^\/?referrer:([^/:]*)(?::([^/]*))?\//;
    const matches = regex.exec(url);
    const referrerIde = matches?.[2];
    return referrerIde;
}
