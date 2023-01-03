/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useState } from "react";
import Alert from "./components/Alert";
import { getGitpodService, gitpodHostUrl } from "./service/service";

const KEY_APP_NOTIFICATIONS = "gitpod-app-notifications";

export function AppNotifications() {
    const [notifications, setNotifications] = useState<string[]>([]);

    useEffect(() => {
        let localState = getLocalStorageObject(KEY_APP_NOTIFICATIONS);
        if (Array.isArray(localState)) {
            setNotifications(localState);
            return;
        }
        reloadNotifications().catch(console.error);

        getGitpodService().registerClient({
            onNotificationUpdated: () => reloadNotifications().catch(console.error),
        });
    }, []);

    const reloadNotifications = async () => {
        const serverState = await getGitpodService().server.getNotifications();
        setNotifications(serverState);
        removeLocalStorageObject(KEY_APP_NOTIFICATIONS);
        if (serverState.length > 0) {
            setLocalStorageObject(KEY_APP_NOTIFICATIONS, serverState, /* expires in */ 300 /* seconds */);
        }
    };

    const topNotification = notifications[0];

    if (topNotification === undefined) {
        return null;
    }

    const dismissNotification = () => {
        removeLocalStorageObject(KEY_APP_NOTIFICATIONS);
        setNotifications([]);
    };

    const getManageBilling = () => {
        let href;
        if (notifications.length === 1) {
            href = `${gitpodHostUrl}billing`;
        } else if (notifications.length === 2) {
            href = `${gitpodHostUrl}t/${notifications[notifications.length - 1]}/billing`;
        }
        return (
            <span>
                {" "}
                Manage
                <a className="gp-link hover:text-gray-600" href={href}>
                    {" "}
                    billing.
                </a>
            </span>
        );
    };

    return (
        <div className="app-container pt-2">
            <Alert
                type={"warning"}
                closable={true}
                onClose={() => dismissNotification()}
                showIcon={true}
                className="flex rounded mb-2 w-full"
            >
                {topNotification}
                {getManageBilling()}
            </Alert>
        </div>
    );
}

function getLocalStorageObject(key: string): any {
    try {
        const string = window.localStorage.getItem(key);
        if (!string) {
            return;
        }
        const stored = JSON.parse(string);
        if (Date.now() > stored.expirationTime) {
            window.localStorage.removeItem(key);
            return undefined;
        }
        return stored.value;
    } catch (error) {
        window.localStorage.removeItem(key);
    }
}

function removeLocalStorageObject(key: string): void {
    window.localStorage.removeItem(key);
}

function setLocalStorageObject(key: string, object: Object, expiresInSeconds: number): void {
    try {
        window.localStorage.setItem(
            key,
            JSON.stringify({ expirationTime: Date.now() + expiresInSeconds * 1000, value: object }),
        );
    } catch (error) {
        console.error("Setting localstorage item failed", key, object, error);
    }
}
