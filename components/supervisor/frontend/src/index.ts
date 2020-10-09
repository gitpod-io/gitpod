/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

require('../src/shared/index.css');
require("reflect-metadata");

import { createGitpodService } from "@gitpod/gitpod-protocol";
import * as GitpodServiceClient from "./ide/gitpod-service-client";
import * as heartBeat from "./ide/heart-beat";
import * as IDEService from "./ide/ide-service-impl";
import * as LoadingFrame from "./shared/loading-frame";
import { SupervisorServiceClient } from "./ide/supervisor-service-client";
import { serverUrl, startUrl } from "./shared/urls";
import * as IDEWebSocket from "./ide/ide-web-socket";

window.gitpod = {
    service: createGitpodService(serverUrl.toString())
};
IDEWebSocket.install();
const pendingGitpodServiceClient = GitpodServiceClient.create();
(async () => {
    const gitpodServiceClient = await pendingGitpodServiceClient;

    document.title = gitpodServiceClient.info.workspace.description;

    if (gitpodServiceClient.info.workspace.type !== 'regular') {
        return;
    }

    //#region web socket
    const supervisorServiceClinet = new SupervisorServiceClient(gitpodServiceClient)
    await Promise.all([supervisorServiceClinet.ideReady, supervisorServiceClinet.contentReady]);
    IDEWebSocket.connectWorkspace();
    const listener = gitpodServiceClient.onDidChangeInfo(() => {
        const phase = gitpodServiceClient.info.latestInstance?.status.phase;
        if (phase === 'stopping' || phase === 'stopped') {
            listener.dispose();
            IDEWebSocket.disconnectWorkspace();
        }
    });
    //#endregion
})();

window.addEventListener('DOMContentLoaded', async () => {
    document.body.style.visibility = 'hidden';

    const [loading, gitpodServiceClient] = await Promise.all([
        LoadingFrame.load({ gitpodService: window.gitpod.service }),
        pendingGitpodServiceClient
    ]);

    if (gitpodServiceClient.info.workspace.type !== 'regular') {
        return;
    }

    const ideService = IDEService.create();

    //#region current-frame
    let currentFrame: HTMLElement = loading.frame;
    let stopped = false;
    const nextFrame = () => {
        const instance = gitpodServiceClient.info.latestInstance;
        if (instance) {
            if (instance.status.phase === 'running' && ideService.state === 'ready') {
                return document.body;
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
                window.location.href = startUrl.toString();
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
    ideService.onDidChange(() => updateCurrentFrame());
    //#endregion

    //#region heart-beat
    heartBeat.track(window);
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
}, { once: true });