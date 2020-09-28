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
import * as SupervisorServiceClient from "./supervisor-service-client";

(async () => {
    // first fetch loading screen to ensure that the owner token cookie is set
    const loadingFrame = await LoadingFrame.load();

    window.gitpod = {
        service: createGitpodService(serverUrl.toString())
    };

    const gitpodServiceClient = await GitpodServiceClient.create();
    document.title = gitpodServiceClient.info.workspace.description;

    const ideFrame = await IdeFrame.load();

    //#region current-frame
    let currentFrame: HTMLIFrameElement = loadingFrame;
    let stopped = false;
    const nextFrame = () => {
        const instance = gitpodServiceClient.info.latestInstance;
        if (instance) {
            if (instance.status.phase === 'running' && ideFrame.parentElement) {
                return ideFrame;
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
        return loadingFrame;
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
    //#endregion

    //#region heart-beat
    const workspaceInfo = await SupervisorServiceClient.fetchWorkspaceInfo();
    heartBeat.track(window);
    heartBeat.track(ideFrame.contentWindow!);
    const updateHeartBeat = () => {
        if (gitpodServiceClient.info.latestInstance?.status.phase === 'running') {
            heartBeat.schedule(workspaceInfo);
        } else {
            heartBeat.cancel();
        }
    }
    updateHeartBeat();
    gitpodServiceClient.onDidChangeInfo(() => updateHeartBeat());
    //#endregion
})();