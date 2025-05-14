/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { organizationClient } from "../../service/public-api";
import { MaintenanceNotification } from "@gitpod/gitpod-protocol";

export const maintenanceNotificationQueryKey = (orgId: string) => ["maintenance-notification", orgId];

export const useMaintenanceNotification = () => {
    const { data: org } = useCurrentOrg();

    const { data, isLoading } = useQuery<MaintenanceNotification>(
        maintenanceNotificationQueryKey(org?.id || ""),
        async () => {
            if (!org?.id) return { enabled: false };

            try {
                const response = await organizationClient.getMaintenanceNotification({
                    organizationId: org.id,
                });
                return {
                    enabled: response.isEnabled,
                    message: response.message,
                };
            } catch (error) {
                console.error("Failed to fetch maintenance notification settings", error);
                return { enabled: false };
            }
        },
        {
            enabled: !!org?.id,
            staleTime: 30 * 1000, // 30 seconds
            refetchInterval: 60 * 1000, // 1 minute
        },
    );

    return {
        isNotificationEnabled: data?.enabled || false,
        notificationMessage: data?.message,
        isLoading,
    };
};
