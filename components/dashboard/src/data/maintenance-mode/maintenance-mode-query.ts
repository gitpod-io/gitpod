/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { organizationClient } from "../../service/public-api";

export const maintenanceModeQueryKey = (orgId: string) => ["maintenance-mode", orgId];

export const useMaintenanceMode = () => {
    const { data: org } = useCurrentOrg();

    const { data: isMaintenanceMode = false, isLoading } = useQuery(
        maintenanceModeQueryKey(org?.id || ""),
        async () => {
            if (!org?.id) return false;

            try {
                const response = await organizationClient.getOrganizationMaintenanceMode({
                    organizationId: org.id,
                });
                return response.enabled;
            } catch (error) {
                console.error("Failed to fetch maintenance mode status", error);
                return false;
            }
        },
        {
            enabled: !!org?.id,
            staleTime: 30 * 1000, // 30 seconds
            refetchInterval: 60 * 1000, // 1 minute
        },
    );

    return {
        isMaintenanceMode,
        isLoading,
    };
};
