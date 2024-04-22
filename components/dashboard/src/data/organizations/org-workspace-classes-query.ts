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
import { noPersistence } from "../setup";

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
    // We don't persistence listOrganizationWorkspaceClasses because org settings updated by owner will not notify members to invalidate listOrganizationWorkspaceClasses
    // TODO: Or we need to handle special ErrorCodes from server somewhere
    // i.e. CreateAndStartWorkspace respond selected workspace class is not allowed
    return noPersistence(["listOrganizationWorkspaceClasses", organizationId || "undefined"]);
}
