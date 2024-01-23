/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { prebuildClient } from "../../service/public-api";
import { Prebuild } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

type Args = {
    projectId: string;
};
export const useLatestProjectPrebuildQuery = ({ projectId }: Args) => {
    return useQuery<Prebuild | null>({
        queryKey: getLatestProjectPrebuildQueryKey(projectId),
        // Prevent bursting for latest project prebuilds too frequently
        staleTime: 1000 * 60 * 1, // 1 minute
        queryFn: async () => {
            try {
                const response = await prebuildClient.listPrebuilds({
                    configurationId: projectId,
                    pagination: {
                        pageSize: 1,
                    },
                });
                return response.prebuilds[0] || null;
            } catch (e) {
                if (ApplicationError.hasErrorCode(e) && e.code === ErrorCodes.NOT_FOUND) {
                    return null;
                }
                throw e;
            }
        },
    });
};

export const getLatestProjectPrebuildQueryKey = (projectId: string) => {
    return ["prebuilds", "latest", { projectId }];
};
