/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { UrlProvider } from "reconnecting-websocket";

/**
 * UrlProvider of url, hold until the document or iframe's parent is visible.
 * returns when the document is visible or after a random delay between 1 and 4 minutes.
 */
export const getUrlProvider = (url: string): UrlProvider => {
    return () =>
        new Promise<string>((resolve) => {
            const checkVisibility = () =>
                document.visibilityState === "visible" ||
                (window.self !== window.top && window.parent.document.visibilityState === "visible");
            if (checkVisibility()) {
                resolve(url);
                return;
            }
            const delay = Math.floor(Math.random() * 240000) + 60000; // between 1 and 4 minutes
            let timer: ReturnType<typeof setTimeout> | undefined;
            const eventHandler = () => {
                if (checkVisibility()) {
                    resolve(url);
                    cleanup();
                }
            };
            const cleanup = () => {
                document.removeEventListener("visibilitychange", eventHandler);
                if (window.self !== window.top) {
                    window.parent.document.removeEventListener("visibilitychange", eventHandler);
                }
                if (timer) {
                    clearTimeout(timer);
                }
            };
            document.addEventListener("visibilitychange", eventHandler);
            if (window.self !== window.top) {
                // Also listen to the parent document's visibility if inside an iframe
                window.parent.document.addEventListener("visibilitychange", eventHandler);
            }
            timer = setTimeout(() => {
                resolve(url);
                cleanup();
            }, delay);
        });
};
