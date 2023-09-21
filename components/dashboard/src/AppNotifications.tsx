/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useCallback, useEffect, useState } from "react";
import Alert, { AlertType } from "./components/Alert";
import { useFeatureFlag } from "./data/featureflag-query";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import advancedFormat from "dayjs/plugin/advancedFormat";

const KEY_APP_DISMISSED_NOTIFICATIONS = "gitpod-app-notifications-dismissed";

interface Notification {
    id: string;
    type: AlertType;
    message: JSX.Element;
}

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);

function localizedTime(dateStr: string): JSX.Element {
    const formatted = dayjs.utc(dateStr).local().format("dddd, MMM. D, HH:mm (z)");
    return <time dateTime={dateStr}>{formatted}</time>;
}

const SCHEDULED_DOWNTIME: Notification = {
    id: "230924-scheduled-downtime",
    type: "info",
    message: (
        <span className="text-md">
            Gitpod will be uncharacteristically unavailable for essential maintenance beginning{" "}
            <span className="font-semibold">{localizedTime("2023-09-24T05:00:00.000Z")}</span> and lasting up to one
            hour. We apologize for any inconvenience this may cause.{" "}
            <a className="gp-link" href="https://www.gitpodstatus.com" target="_blank" rel="noreferrer">
                Learn more
            </a>
        </span>
    ),
};

export function AppNotifications() {
    const [topNotification, setTopNotification] = useState<Notification | undefined>(undefined);

    const downtimeNotificationEnabled = useFeatureFlag("scheduled_downtime_notification");

    useEffect(() => {
        const notifications = [];
        if (downtimeNotificationEnabled) {
            notifications.push(SCHEDULED_DOWNTIME);
        }

        const dismissedNotifications = getDismissedNotifications();
        const topNotification = notifications.find((n) => !dismissedNotifications.includes(n.id));
        setTopNotification(topNotification);
    }, [downtimeNotificationEnabled, setTopNotification]);

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
                onClose={() => dismissNotification()}
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
