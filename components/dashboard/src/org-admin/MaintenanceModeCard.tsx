/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { useToast } from "../components/toasts/Toasts";
import { Button } from "@podkit/buttons/Button";
import { useMaintenanceMode } from "../data/maintenance-mode/maintenance-mode-query";
import { useSetMaintenanceModeMutation } from "../data/maintenance-mode/maintenance-mode-mutation";
import { ConfigurationSettingsField } from "../repositories/detail/ConfigurationSettingsField";
import { Heading3 } from "@podkit/typography/Headings";

export const MaintenanceModeCard: FC = () => {
    const { isMaintenanceMode, isLoading } = useMaintenanceMode();
    const setMaintenanceModeMutation = useSetMaintenanceModeMutation();
    const toast = useToast();

    const toggleMaintenanceMode = async () => {
        try {
            const newState = !isMaintenanceMode;
            const result = await setMaintenanceModeMutation.mutateAsync({ enabled: newState });

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
        <ConfigurationSettingsField>
            <div className="flex justify-between items-center">
                <div>
                    <Heading3>Maintenance Mode</Heading3>
                    <p className="text-pk-content-tertiary">
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
        </ConfigurationSettingsField>
    );
};
