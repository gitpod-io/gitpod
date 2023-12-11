/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { organizationClient } from "../../service/public-api";
import { useCallback } from "react";
import { useCurrentOrg } from "./orgs-query";
import { WorkspaceClass } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";

export function useOrgWorkspaceClassesQueryInvalidator() {
    const organizationId = useCurrentOrg().data?.id;
    const queryClient = useQueryClient();
    return useCallback(() => {
        queryClient.invalidateQueries(getQueryKey(organizationId));
    }, [organizationId, queryClient]);
}

export function useOrgWorkspaceClassesQuery() {
    const organizationId = useCurrentOrg().data?.id;
    return useQuery<WorkspaceClass[], Error>(
        getQueryKey(organizationId),
        async () => {
            if (!organizationId) {
                throw new Error("No org selected.");
            }

            const settings = await organizationClient.listOrganizationWorkspaceClasses({ organizationId });
            return settings.workspaceClasses || [];
        },
        {
            enabled: !!organizationId,
        },
    );
}

function getQueryKey(organizationId?: string) {
    return ["listOrganizationWorkspaceClasses", organizationId || "undefined"];
}
