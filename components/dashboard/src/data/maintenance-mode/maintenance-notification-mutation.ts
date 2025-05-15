/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { organizationClient } from "../../service/public-api";
import { MaintenanceNotification } from "@gitpod/gitpod-protocol";
import { maintenanceNotificationQueryKey } from "./maintenance-notification-query";

export interface SetMaintenanceNotificationArgs {
    isEnabled: boolean;
    customMessage?: string;
}

export const useSetMaintenanceNotificationMutation = () => {
    const { data: org } = useCurrentOrg();
    const queryClient = useQueryClient();
    const organizationId = org?.id ?? "";

    return useMutation<MaintenanceNotification, Error, SetMaintenanceNotificationArgs>({
        mutationFn: async ({ isEnabled, customMessage }) => {
            if (!organizationId) {
                throw new Error("No organization selected");
            }

            try {
                const response = await organizationClient.setMaintenanceNotification({
                    organizationId,
                    isEnabled,
                    customMessage,
                });

                const result: MaintenanceNotification = {
                    enabled: response.isEnabled,
                    message: response.message,
                };

                return result;
            } catch (error) {
                console.error("Failed to set maintenance notification", error);
                throw error;
            }
        },
        onSuccess: (result) => {
            // Update the cache
            queryClient.setQueryData(maintenanceNotificationQueryKey(organizationId), result);
        },
    });
};
