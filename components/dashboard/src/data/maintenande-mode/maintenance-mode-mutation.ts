/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { organizationClient } from "../../service/public-api";
import { maintenanceModeQueryKey } from "./maintenance-mode-query";

export interface SetMaintenanceModeArgs {
    enabled: boolean;
}

export const useSetMaintenanceModeMutation = () => {
    const { data: org } = useCurrentOrg();
    const queryClient = useQueryClient();
    const organizationId = org?.id ?? "";

    return useMutation<boolean, Error, SetMaintenanceModeArgs>({
        mutationFn: async ({ enabled }) => {
            if (!organizationId) {
                throw new Error("No organization selected");
            }

            try {
                const response = await organizationClient.setOrganizationMaintenanceMode({
                    organizationId,
                    enabled,
                });
                return response.enabled;
            } catch (error) {
                console.error("Failed to set maintenance mode", error);
                throw error;
            }
        },
        onSuccess: (result) => {
            // Update the cache
            queryClient.setQueryData(maintenanceModeQueryKey(organizationId), result);
        },
    });
};
