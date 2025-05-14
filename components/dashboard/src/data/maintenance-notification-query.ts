/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "./organizations/orgs-query";
import { organizationClient } from "../service/public-api";
import { MaintenanceNotification } from "@gitpod/gitpod-protocol";

export const maintenanceNotificationQueryKey = (orgId: string) => ["maintenance-notification", orgId];

export const useMaintenanceNotification = () => {
    const { data: org } = useCurrentOrg();
    const queryClient = useQueryClient();

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

    const setMaintenanceNotification = async (
        isEnabled: boolean,
        customMessage?: string,
    ): Promise<MaintenanceNotification> => {
        if (!org?.id) return { enabled: false, message: "" };

        try {
            const response = await organizationClient.setMaintenanceNotification({
                organizationId: org.id,
                isEnabled,
                customMessage,
            });

            const result: MaintenanceNotification = {
                enabled: response.isEnabled,
                message: response.message,
            };

            // Update the cache
            queryClient.setQueryData(maintenanceNotificationQueryKey(org.id), result);

            return result;
        } catch (error) {
            console.error("Failed to set maintenance notification", error);
            return { enabled: false };
        }
    };

    return {
        isNotificationEnabled: data?.enabled || false,
        notificationMessage: data?.message,
        isLoading,
        setMaintenanceNotification,
    };
};
