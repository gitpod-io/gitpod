/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceSession } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { useQuery } from "@tanstack/react-query";
import { workspaceClient } from "../../service/public-api";
import { useCurrentOrg } from "../organizations/orgs-query";

export const useWorkspaceSessions = () => {
    const { data: org } = useCurrentOrg();

    const query = useQuery<WorkspaceSession[]>({
        queryKey: getAuthProviderDescriptionsQueryKey(org?.id),
        queryFn: async () => {
            if (!org) {
                throw new Error("No org specified");
            }
            const response = await workspaceClient.listWorkspaceSessions({
                organizationId: org.id,
            });
            return response.workspaceSessions;
        },
        enabled: !!org,
    });
    return query;
};

export const getAuthProviderDescriptionsQueryKey = (orgId?: string) => ["workspace-sessions", { orgId }];
