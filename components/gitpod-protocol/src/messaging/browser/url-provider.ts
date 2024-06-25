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
export const getUrlProvider = (url: string, returnImmediately: () => Promise<boolean>): UrlProvider => {
    return () =>
        new Promise<string>(async (resolve) => {
            if (await returnImmediately()) {
                console.log(`hwen: [${url}] return immediately`);
                resolve(url);
                return;
            }
            const checkVisibility = () =>
                document.visibilityState === "visible" ||
                (window.self !== window.top && window.parent.document.visibilityState === "visible");
            if (checkVisibility()) {
                console.log(`hwen: [${url}] is visible`);
                resolve(url);
                return;
            }
            const delay = Math.floor(Math.random() * 240000) + 60000;
            let timer: ReturnType<typeof setTimeout> | undefined;
            const eventHandler = () => {
                if (checkVisibility()) {
                    console.log(`hwen: [${url}] become visible`);
                    resolve(url);
                    cleanup();
                }
            };
            const cleanup = () => {
                document.removeEventListener("visibilitychange", eventHandler);
                if (window.self !== window.top) {
                    try {
                        window.parent.document.removeEventListener("visibilitychange", eventHandler);
                    } catch (err) {
                        console.warn(`hwen: [${url}] error removing event listener: ${err}`);
                    }
                }
                if (timer) {
                    clearTimeout(timer);
                }
            };
            document.addEventListener("visibilitychange", eventHandler);
            if (window.self !== window.top) {
                try {
                    // Also listen to the parent document's visibility if inside an iframe
                    window.parent.document.addEventListener("visibilitychange", eventHandler);
                } catch (err) {
                    console.warn(`hwen: [${url}] error adding event listener: ${err}, resolve immediately`);
                    resolve(url);
                    cleanup();
                    return;
                }
            }
            timer = setTimeout(() => {
                console.log(`hwen: [${url}] max delay reached`);
                resolve(url);
                cleanup();
            }, delay);
        });
};
