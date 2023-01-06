/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { GitpodClient, GitpodService, GitpodServer, GitpodServiceImpl } from "@gitpod/gitpod-protocol";
import {
    WindowMessageReader,
    WindowMessageWriter,
} from "@gitpod/gitpod-protocol/lib/messaging/browser/window-connection";
import { JsonRpcProxyFactory } from "@gitpod/gitpod-protocol/lib/messaging/proxy-factory";
import { createMessageConnection } from "vscode-jsonrpc/lib/main";
import { ConsoleLogger } from "vscode-ws-jsonrpc";
import { isSaaSServerGreaterThan } from "../ide/gitpod-server-compatibility";
import { startUrl } from "./urls";

let openDesktopLinkSupported = false;
// TODO(ak) remove after 15.09.2022
isSaaSServerGreaterThan("main.4275").then((r) => (openDesktopLinkSupported = r));

const serverOrigin = startUrl.url.origin;
const relocateListener = (event: MessageEvent) => {
    if (event.origin === serverOrigin && event.data.type == "relocate" && event.data.url) {
        window.removeEventListener("message", relocateListener);
        window.location.href = event.data.url;
    }
};
window.addEventListener("message", relocateListener, false);

let resolveSessionId: (sessionId: string) => void;
const sessionId = new Promise<string>((resolve) => (resolveSessionId = resolve));
const setSessionIdListener = (event: MessageEvent) => {
    if (event.origin === serverOrigin && event.data.type == "$setSessionId" && event.data.sessionId) {
        window.removeEventListener("message", setSessionIdListener);
        resolveSessionId(event.data.sessionId);
    }
};
window.addEventListener("message", setSessionIdListener, false);

export function load(): Promise<{
    frame: HTMLIFrameElement;
    sessionId: Promise<string>;
    setState: (state: object) => void;
    openDesktopLink: (link: string) => void;
    service: GitpodService;
}> {
    return new Promise((resolve) => {
        const frame = document.createElement("iframe");
        frame.src = startUrl.toString();
        frame.style.visibility = "visible";
        frame.className = "gitpod-frame loading";
        document.body.appendChild(frame);

        const factory = new JsonRpcProxyFactory<GitpodServer>();
        const reader = new WindowMessageReader("gitpodServer", serverOrigin);
        frame.onload = () => {
            const frameWindow = frame.contentWindow!;
            const writer = new WindowMessageWriter("gitpodServer", frameWindow, serverOrigin);
            const connection = createMessageConnection(reader, writer, new ConsoleLogger());
            factory.listen(connection);

            const setState = (state: object) => {
                frameWindow.postMessage({ type: "setState", state }, serverOrigin);
            };

            const openDesktopLink = (link: string) => {
                if (openDesktopLinkSupported) {
                    frameWindow.postMessage({ type: "$openDesktopLink", link }, serverOrigin);
                } else {
                    let redirect = false;
                    try {
                        const desktopLink = new URL(link);
                        redirect = desktopLink.protocol !== "http:" && desktopLink.protocol !== "https:";
                    } catch (e) {
                        console.error("invalid desktop link:", e);
                    }
                    // redirect only if points to desktop application
                    // don't navigate browser to another page
                    if (redirect) {
                        window.location.href = link;
                    } else {
                        window.open(link, "_blank", "noopener");
                    }
                }
            };

            resolve({
                frame,
                sessionId,
                setState,
                openDesktopLink,
                service: new GitpodServiceImpl<GitpodClient, GitpodServer>(factory.createProxy()),
            });
        };
    });
}
