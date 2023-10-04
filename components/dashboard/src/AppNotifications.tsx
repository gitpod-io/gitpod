/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useCallback, useEffect, useState } from "react";
import Alert, { AlertType } from "./components/Alert";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import advancedFormat from "dayjs/plugin/advancedFormat";
import { useUserLoader } from "./hooks/use-user-loader";
import { getGitpodService } from "./service/service";
import { deepMerge } from "./utils";

const KEY_APP_DISMISSED_NOTIFICATIONS = "gitpod-app-notifications-dismissed";
const PRIVACY_POLICY_LAST_UPDATED = "2023-09-26";

interface Notification {
    id: string;
    type: AlertType;
    message: JSX.Element;
    preventDismiss?: boolean;
    onClose?: () => void;
}

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);

export function localizedTime(dateStr: string): JSX.Element {
    const formatted = dayjs.utc(dateStr).local().format("dddd, MMM. D, HH:mm (z)");
    return <time dateTime={dateStr}>{formatted}</time>;
}

export function formatDate(dateString: string): JSX.Element {
    const formatted = dayjs.utc(dateString).local().format("MMMM D, YYYY");
    return <time dateTime={dateString}>{formatted}</time>;
}

const UPDATED_PRIVACY_POLICY: Notification = {
    id: "privacy-policy-update",
    type: "info",
    preventDismiss: true,
    onClose: async () => {
        const userUpdates = { additionalData: { profile: { acceptedPrivacyPolicyDate: dayjs().toISOString() } } };
        const previousUser = await getGitpodService().server.getLoggedInUser();
        await getGitpodService().server.updateLoggedInUser(deepMerge(previousUser, userUpdates));
    },
    message: (
        <span className="text-md">
            We've updated our Privacy Policy. You can review it{" "}
            <a className="gp-link" href="https://www.gitpod.io/privacy" target="_blank" rel="noreferrer">
                here
            </a>
            .
        </span>
    ),
};

export function AppNotifications() {
    const [topNotification, setTopNotification] = useState<Notification | undefined>(undefined);
    const { user, loading } = useUserLoader();

    useEffect(() => {
        const notifications = [];
        if (!loading && user?.additionalData?.profile) {
            if (
                !user.additionalData.profile.acceptedPrivacyPolicyDate ||
                new Date(PRIVACY_POLICY_LAST_UPDATED) > new Date(user.additionalData.profile?.acceptedPrivacyPolicyDate)
            ) {
                notifications.push(UPDATED_PRIVACY_POLICY);
            }
        }

        const dismissedNotifications = getDismissedNotifications();
        const topNotification = notifications.find((n) => !dismissedNotifications.includes(n.id));
        setTopNotification(topNotification);
    }, [loading, setTopNotification, user]);

    const dismissNotification = useCallback(() => {
        if (!topNotification) {
            return;
        }

        const dismissedNotifications = getDismissedNotifications();
        dismissedNotifications.push(topNotification.id);
        setDismissedNotifications(dismissedNotifications);
        setTopNotification(undefined);
    }, [topNotification, setTopNotification]);

    if (!topNotification) {
        return <></>;
    }

    return (
        <div className="app-container pt-2">
            <Alert
                type={topNotification.type}
                closable={true}
                onClose={() => {
                    if (!topNotification.preventDismiss) {
                        dismissNotification();
                    } else {
                        if (topNotification.onClose) {
                            topNotification.onClose();
                        }
                    }
                }}
                showIcon={true}
                className="flex rounded mb-2 w-full"
            >
                <span>{topNotification.message}</span>
            </Alert>
        </div>
    );
}

function getDismissedNotifications(): string[] {
    try {
        const str = window.localStorage.getItem(KEY_APP_DISMISSED_NOTIFICATIONS);
        const parsed = JSON.parse(str || "[]");
        if (!Array.isArray(parsed)) {
            window.localStorage.removeItem(KEY_APP_DISMISSED_NOTIFICATIONS);
            return [];
        }
        return parsed;
    } catch (err) {
        console.debug("Failed to parse dismissed notifications", err);
        window.localStorage.removeItem(KEY_APP_DISMISSED_NOTIFICATIONS);
        return [];
    }
}

function setDismissedNotifications(ids: string[]) {
    try {
        window.localStorage.setItem(KEY_APP_DISMISSED_NOTIFICATIONS, JSON.stringify(ids));
    } catch (err) {
        console.debug("Failed to set dismissed notifications", err);
        window.localStorage.removeItem(KEY_APP_DISMISSED_NOTIFICATIONS);
    }
}
