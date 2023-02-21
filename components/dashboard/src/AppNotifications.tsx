/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AppNotification } from "@gitpod/gitpod-protocol";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Alert from "./components/Alert";
import { getGitpodService } from "./service/service";

const KEY_APP_NOTIFICATIONS = "gitpod-app-notifications";

export function AppNotifications() {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    useEffect(() => {
        let localState = getLocalStorageObject(KEY_APP_NOTIFICATIONS);
        if (Array.isArray(localState)) {
            setNotifications(convertToAppNotification(localState));
            return;
        }
        reloadNotifications().catch(console.error);

        getGitpodService().registerClient({
            onNotificationUpdated: () => reloadNotifications().catch(console.error),
        });
    }, []);

    const reloadNotifications = async () => {
        const serverState = convertToAppNotification(await getGitpodService().server.getNotifications());
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

    return (
        <div className="app-container pt-2">
            <Alert
                type={"message"}
                closable={!topNotification.notClosable}
                onClose={() => dismissNotification()}
                showIcon={true}
                className="flex rounded mb-2 w-full"
            >
                {topNotification.message}
                {topNotification.action && (
                    <>
                        {" "}
                        <Link to={topNotification.action.url}>
                            <a className="gp-link" href={topNotification.action.url}>
                                {topNotification.action.label}
                            </a>
                        </Link>
                    </>
                )}
            </Alert>
        </div>
    );
}

function getLocalStorageObject(key: string): any {
    try {
        const string = window.localStorage.getItem(key);
        if (!string) {
            return undefined;
        }
        const stored = JSON.parse(string);
        if (Date.now() > stored.expirationTime) {
            window.localStorage.removeItem(key);
            return undefined;
        }
        return stored.value;
    } catch (error) {
        window.localStorage.removeItem(key);
        return undefined;
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

// Required to guarantee smooth rollout
function convertToAppNotification(array: string[] | AppNotification[] | any): AppNotification[] {
    if (!array || !Array.isArray(array)) {
        return [];
    }

    const notifications: AppNotification[] = [];
    for (const a of array) {
        if (typeof a === "string") {
            notifications.push({ message: a });
        } else if (AppNotification.is(a)) {
            notifications.push(a);
        }
    }
    return notifications;
}
