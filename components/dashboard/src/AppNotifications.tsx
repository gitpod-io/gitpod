/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useEffect, useState } from "react";
import Alert from "./components/Alert";
import { getGitpodService } from "./service/service";
import { isLocalPreview } from "./utils";

const KEY_APP_NOTIFICATIONS = "KEY_APP_NOTIFICATIONS";

export function AppNotifications() {
    const [notifications, setNotifications] = useState<string[]>([]);

    useEffect(() => {
        if (isLocalPreview()) {
            const notificationText = `You are using a <b>local preview</b> installation, intended for exploring the product on a
            single machine without requiring a Kubernetes cluster.{" "}
            ${(
                <a
                    className="gp-link hover:text-gray-600"
                    href="https://www.gitpod.io/community-license?utm_source=local-preview"
                >
                    Request a community license
                </a>
            )} or
            ${(
                <a
                    className="gp-link hover:text-gray-600"
                    href="https://www.gitpod.io/contact/sales?utm_source=local-preview"
                >
                    contact sales{" "}
                </a>
            )} to get a professional license for running Gitpod in production.`;
            setNotifications([notificationText]);
        }
    }, []);

    useEffect(() => {
        let localState = getLocalStorageObject(KEY_APP_NOTIFICATIONS);
        if (Array.isArray(localState)) {
            setNotifications(localState);
            return;
        }
        (async () => {
            const serverState = await getGitpodService().server.getNotifications();
            setNotifications(serverState);
            setLocalStorageObject(KEY_APP_NOTIFICATIONS, serverState);
        })();
    }, []);

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
                type={"warning"}
                closable={true}
                onClose={() => dismissNotification()}
                showIcon={true}
                className="flex rounded mb-2 w-full"
            >
                <span>{topNotification}</span>
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
        return JSON.parse(string);
    } catch (error) {
        return;
    }
}

function removeLocalStorageObject(key: string): void {
    window.localStorage.removeItem(key);
}

function setLocalStorageObject(key: string, object: Object): void {
    try {
        window.localStorage.setItem(key, JSON.stringify(object));
    } catch (error) {
        console.error("Setting localstorage item failed", key, object, error);
    }
}
