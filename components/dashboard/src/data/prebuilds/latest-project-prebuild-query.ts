/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PrebuildWithStatus } from "@gitpod/gitpod-protocol";
import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";

export type LatestProjectPrebuildQueryResult = PrebuildWithStatus;

type Args = {
    projectId: string;
};
export const useLatestProjectPrebuildQuery = ({ projectId }: Args) => {
    return useQuery<LatestProjectPrebuildQueryResult>({
        queryKey: getLatestProjectPrebuildQueryKey(projectId),
        queryFn: async () => {
            const latestPrebuilds = await getGitpodService().server.findPrebuilds({
                projectId,
                latest: true,
            });

            return latestPrebuilds[0];
        },
    });
};

export const getLatestProjectPrebuildQueryKey = (projectId: string) => {
    return ["prebuilds", "latest", { projectId }];
};
