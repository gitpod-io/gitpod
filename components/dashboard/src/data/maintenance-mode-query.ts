/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "./organizations/orgs-query";
import { organizationClient } from "../service/public-api";

export const maintenanceModeQueryKey = (orgId: string) => ["maintenance-mode", orgId];

export const useMaintenanceMode = () => {
    const { data: org } = useCurrentOrg();
    const queryClient = useQueryClient();

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

    const setMaintenanceMode = async (enabled: boolean) => {
        if (!org?.id) return false;

        try {
            const response = await organizationClient.setOrganizationMaintenanceMode({
                organizationId: org.id,
                enabled,
            });
            const result = response.enabled;

            // Update the cache
            queryClient.setQueryData(maintenanceModeQueryKey(org.id), result);

            return result;
        } catch (error) {
            console.error("Failed to set maintenance mode", error);
            return false;
        }
    };

    return {
        isMaintenanceMode,
        isLoading,
        setMaintenanceMode,
    };
};
