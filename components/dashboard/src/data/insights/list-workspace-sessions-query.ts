/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import { WorkspaceSession } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { useInfiniteQuery } from "@tanstack/react-query";
import { workspaceClient } from "../../service/public-api";
import { useCurrentOrg } from "../organizations/orgs-query";
import { Timestamp } from "@bufbuild/protobuf";

const pageSize = 100;

type Params = {
    from?: Timestamp;
    to?: Timestamp;
};
export const useWorkspaceSessions = ({ from, to }: Params = {}) => {
    const { data: org } = useCurrentOrg();

    const query = useInfiniteQuery<WorkspaceSession[]>({
        queryKey: getAuthProviderDescriptionsQueryKey(org?.id, from, to),
        queryFn: async ({ pageParam }) => {
            if (!org) {
                throw new Error("No org specified");
            }

            const response = await workspaceClient.listWorkspaceSessions({
                organizationId: org.id,
                from,
                to,
                pagination: {
                    page: pageParam ?? 0,
                    pageSize,
                },
            });

            return response.workspaceSessions;
        },
        getNextPageParam: (lastPage, pages) => {
            const hasMore = lastPage.length === pageSize;
            return hasMore ? pages.length : undefined;
        },
        enabled: !!org,
    });

    return query;
};

export const getAuthProviderDescriptionsQueryKey = (orgId?: string, from?: Timestamp, to?: Timestamp) => [
    "workspace-sessions",
    { orgId, from, to },
];
