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

const KEY_APP_DISMISSED_NOTIFICATIONS = "gitpod-app-notifications-dismissed";
const PRIVACY_POLICY_LAST_UPDATED = "09/25/2023";

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

function formatDate(dateString: string): JSX.Element {
    const formatted = dayjs.utc(dateString).local().format("LL");
    return <time dateTime={dateString}>{formatted}</time>;
}

const UPDATED_PRIVACY_POLICY: Notification = {
    id: "privacy-policy-update",
    type: "info",
    preventDismiss: true,
    onClose: () => {
        console.error("Well... happy for you");
    },
    message: (
        <span className="text-md">
            We've updated the Gitpod Privacy Policy on{" "}
            <span className="font-semibold">{formatDate(PRIVACY_POLICY_LAST_UPDATED)}</span>.{" "}
            <a className="gp-link" href="https://www.gitpod.io/privacy" target="_blank" rel="noreferrer">
                Review Privacy Policy
            </a>
        </span>
    ),
};

export function AppNotifications() {
    const [topNotification, setTopNotification] = useState<Notification | undefined>(undefined);
    const { user, loading } = useUserLoader();

    useEffect(() => {
        const notifications = [];
        if (!loading && user?.additionalData) {
            if (new Date(PRIVACY_POLICY_LAST_UPDATED) > new Date(user.additionalData.acceptedPrivacyPoliceDate)) {
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
