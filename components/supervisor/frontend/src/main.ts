/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

require('../public/index.css');

import "reflect-metadata";
import { createGitpodService, GitpodClient } from "@gitpod/gitpod-protocol";
import { serverUrl, startUrl } from "./urls";
import * as heartBeat from "./heart-beat";
import * as LoadingFrame from "./loading-frame";
import * as IdeFrame from "./ide-frame";
import * as GitpodServiceClient from "./gitpod-service-client";
import { SupervisorServiceClient } from "./supervisor-service-client";
import { JsonRpcProxyFactory } from '@gitpod/gitpod-protocol/lib/messaging/proxy-factory';

const serverOrigin = new URL(serverUrl.toString()).origin;
const workspaceOrigin = new URL(window.location.href).origin;
const relocateListener = (event: MessageEvent) => {
    if (event.origin !== serverOrigin && event.origin !== workspaceOrigin) {
        return;
    }
    if (event.data.type == 'relocate' && event.data.url) {
        window.removeEventListener('message', relocateListener);
        window.location.href = event.data.url;
    }
};
window.addEventListener('message', relocateListener, false);

(async () => {
    // first fetch loading screen to ensure that the owner token cookie is set
    const loading = await LoadingFrame.load();

    window.gitpod = {
        service: createGitpodService(serverUrl.toString())
    };
    const factory = new JsonRpcProxyFactory<GitpodClient>(window.gitpod.service.server);
    window.gitpod.service.registerClient(factory.createProxy());
    factory.listen(loading.connection);

    const gitpodServiceClient = await GitpodServiceClient.create();
    document.title = gitpodServiceClient.info.workspace.description;

    if (gitpodServiceClient.info.workspace.type !== 'regular') {
        return;
    }

    const supervisorServiceClient = new SupervisorServiceClient();
    const ide = await IdeFrame.load(supervisorServiceClient);

    //#region current-frame
    let currentFrame: HTMLIFrameElement = loading.frame;
    let stopped = false;
    const nextFrame = () => {
        const instance = gitpodServiceClient.info.latestInstance;
        if (instance) {
            if (instance.status.phase === 'running' && ide.service.state === 'ready') {
                return ide.frame;
            }
            if (instance.status.phase === 'stopped') {
                stopped = true;
            }
            if (stopped && (
                instance.status.phase === 'preparing' ||
                instance.status.phase === 'pending' ||
                instance.status.phase === 'creating' ||
                instance.status.phase === 'initializing')) {
                // reload the page if the workspace was restarted to ensure:
                // - graceful reconnection of IDEs
                // - new owner token is set
                window.location.href = startUrl;
            }
        }
        return loading.frame;
    }
    const updateCurrentFrame = () => {
        const newCurrentFrame = nextFrame();
        if (currentFrame === newCurrentFrame) {
            return;
        }
        currentFrame.style.visibility = 'hidden';
        newCurrentFrame.style.visibility = 'visible';
        currentFrame = newCurrentFrame;
    }

    updateCurrentFrame();
    gitpodServiceClient.onDidChangeInfo(() => updateCurrentFrame());
    ide.service.onDidChange(() => updateCurrentFrame());
    //#endregion

    //#region heart-beat
    heartBeat.track(window);
    heartBeat.track(loading.frame.contentWindow!);
    heartBeat.track(ide.frame.contentWindow!);
    const updateHeartBeat = () => {
        if (gitpodServiceClient.info.latestInstance?.status.phase === 'running') {
            heartBeat.schedule(gitpodServiceClient.info.latestInstance.id);
        } else {
            heartBeat.cancel();
        }
    }
    updateHeartBeat();
    gitpodServiceClient.onDidChangeInfo(() => updateHeartBeat());
    //#endregion
})();
