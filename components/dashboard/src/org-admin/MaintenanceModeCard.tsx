/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { useToast } from "../components/toasts/Toasts";
import { Button } from "@podkit/buttons/Button";
import { useMaintenanceMode } from "../data/maintenance-mode-query";

export const MaintenanceModeCard: FC = () => {
    const { isMaintenanceMode, isLoading, setMaintenanceMode } = useMaintenanceMode();
    const toast = useToast();

    const toggleMaintenanceMode = async () => {
        try {
            const newState = !isMaintenanceMode;
            const result = await setMaintenanceMode(newState);

            toast.toast({
                message: `Maintenance mode ${result ? "enabled" : "disabled"}`,
                type: "success",
            });
        } catch (error) {
            console.error("Failed to toggle maintenance mode", error);
            toast.toast({ message: "Failed to toggle maintenance mode", type: "error" });
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Maintenance Mode</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        When enabled, users cannot start new workspaces and a notification is displayed.
                    </p>
                </div>
                <Button
                    variant={isMaintenanceMode ? "secondary" : "default"}
                    onClick={toggleMaintenanceMode}
                    disabled={isLoading}
                >
                    {isLoading ? "Loading..." : isMaintenanceMode ? "Disable" : "Enable"}
                </Button>
            </div>
        </div>
    );
};
