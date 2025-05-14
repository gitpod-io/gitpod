/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useState, useEffect } from "react";
import { useToast } from "../components/toasts/Toasts";
import { Button } from "@podkit/buttons/Button";
import { useMaintenanceNotification } from "../data/maintenande-mode/maintenance-notification-query";
import { useSetMaintenanceNotificationMutation } from "../data/maintenande-mode/maintenance-notification-mutation";
import Alert from "../components/Alert";

export const MaintenanceNotificationCard: FC = () => {
    const { isNotificationEnabled, notificationMessage, isLoading } = useMaintenanceNotification();
    const setMaintenanceNotificationMutation = useSetMaintenanceNotificationMutation();
    const [message, setMessage] = useState(notificationMessage);
    const [isEditing, setIsEditing] = useState(false);
    const toast = useToast();

    // Update local state when the data from the API changes
    useEffect(() => {
        setMessage(notificationMessage);
    }, [notificationMessage]);

    const toggleNotification = async () => {
        try {
            const newState = !isNotificationEnabled;
            const result = await setMaintenanceNotificationMutation.mutateAsync({
                isEnabled: newState,
                customMessage: message,
            });

            toast.toast({
                message: `Maintenance notification ${result.enabled ? "enabled" : "disabled"}`,
                type: "success",
            });

            setIsEditing(false);
        } catch (error) {
            console.error("Failed to toggle maintenance notification", error);
            toast.toast({ message: "Failed to toggle maintenance notification", type: "error" });
        }
    };

    const saveMessage = async () => {
        try {
            await setMaintenanceNotificationMutation.mutateAsync({
                isEnabled: isNotificationEnabled,
                customMessage: message,
            });

            toast.toast({
                message: "Maintenance notification message updated",
                type: "success",
            });

            setIsEditing(false);
        } catch (error) {
            console.error("Failed to update maintenance notification message", error);
            toast.toast({ message: "Failed to update maintenance notification message", type: "error" });
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                        Scheduled Maintenance Notification
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        Display a notification banner to inform users about upcoming maintenance.
                    </p>
                </div>
                <Button
                    variant={isNotificationEnabled ? "secondary" : "default"}
                    onClick={toggleNotification}
                    disabled={isLoading}
                >
                    {isLoading ? "Loading..." : isNotificationEnabled ? "Disable" : "Enable"}
                </Button>
            </div>

            {/* Message input section */}
            <div className="mt-4">
                <label
                    htmlFor="maintenance-message"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                    Notification Message
                </label>
                {isEditing ? (
                    <div>
                        <textarea
                            id="maintenance-message"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                            rows={3}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Enter a message to display in the notification banner"
                        />
                        <div className="mt-2 flex justify-end space-x-2">
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setMessage(notificationMessage);
                                    setIsEditing(false);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button onClick={saveMessage}>Save</Button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 min-h-[4rem]">
                            {message || (
                                <span className="text-gray-400 dark:text-gray-500 italic">
                                    Default message will be used
                                </span>
                            )}
                        </div>
                        <div className="mt-2 flex justify-end">
                            <Button variant="secondary" onClick={() => setIsEditing(true)}>
                                Edit Message
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Preview section */}
            {isNotificationEnabled && (
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview</label>
                    <Alert type="warning" className="mb-0">
                        <div className="flex items-center">
                            <span className="font-semibold">Scheduled Maintenance:</span>
                            <span className="ml-2">
                                {message || "Maintenance is scheduled for this system. Please save your work."}
                            </span>
                        </div>
                    </Alert>
                </div>
            )}
        </div>
    );
};
