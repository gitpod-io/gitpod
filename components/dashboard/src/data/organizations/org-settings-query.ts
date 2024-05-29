/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { organizationClient } from "../../service/public-api";
import { OrganizationSettings } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { useCallback } from "react";
import { useCurrentOrg } from "./orgs-query";

export function useOrgSettingsQueryInvalidator() {
    const organizationId = useCurrentOrg().data?.id;
    const queryClient = useQueryClient();
    return useCallback(() => {
        queryClient.invalidateQueries(getQueryKey(organizationId));
    }, [organizationId, queryClient]);
}

export function useOrgSettingsQuery() {
    const organizationId = useCurrentOrg().data?.id;
    return useQuery<OrganizationSettings | null, Error, OrganizationSettings | undefined>(
        getQueryKey(organizationId),
        async () => {
            if (!organizationId) {
                return null;
            }

            const settings = await organizationClient.getOrganizationSettings({ organizationId });
            return settings.settings || new OrganizationSettings();
        },
        {
            select: (data) => data || undefined,
        },
    );
}

function getQueryKey(organizationId?: string) {
    return ["getOrganizationSettings", organizationId || "undefined"];
}
