/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/**
 * <script type="text/javascript" src="/_supervisor/frontend/main.js" charset="utf-8"></script> should be inserted to index.html as first body script,
 * all other IDE scripts should go afterwards, head element should not have scripts
 */

require('../src/shared/index.css');

import { createGitpodService, WorkspaceInstancePhase } from "@gitpod/gitpod-protocol";
import { DisposableCollection } from '@gitpod/gitpod-protocol/lib/util/disposable';
import * as GitpodServiceClient from "./ide/gitpod-service-client";
import * as heartBeat from "./ide/heart-beat";
import * as IDEFrontendService from "./ide/ide-frontend-service-impl";
import * as IDEWorker from "./ide/ide-worker";
import * as IDEWebSocket from "./ide/ide-web-socket";
import { SupervisorServiceClient } from "./ide/supervisor-service-client";
import * as LoadingFrame from "./shared/loading-frame";
import { serverUrl, startUrl } from "./shared/urls";

window.gitpod = {
    service: createGitpodService(serverUrl.toString())
};
IDEWorker.install();
IDEWebSocket.install();
const ideService = IDEFrontendService.create();
const pendingGitpodServiceClient = GitpodServiceClient.create();
const loadingIDE = new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve, { once: true }));
(async () => {
    const gitpodServiceClient = await pendingGitpodServiceClient;

    document.title = gitpodServiceClient.info.workspace.description;

    if (gitpodServiceClient.info.workspace.type !== 'regular') {
        return;
    }

    //#region ide lifecycle
    function isWorkspaceInstancePhase(phase: WorkspaceInstancePhase): boolean {
        return gitpodServiceClient.info.latestInstance?.status.phase === phase;
    }
    if (!isWorkspaceInstancePhase('running')) {
        await new Promise<void>(resolve => {
            const listener = gitpodServiceClient.onDidChangeInfo(() => {
                if (isWorkspaceInstancePhase('running')) {
                    listener.dispose();
                    resolve();
                }
            });
        });
    }
    const supervisorServiceClinet = new SupervisorServiceClient(gitpodServiceClient);
    await Promise.all([supervisorServiceClinet.ideReady, supervisorServiceClinet.contentReady, loadingIDE]);
    if (isWorkspaceInstancePhase('stopping') || isWorkspaceInstancePhase('stopped')) {
        return;
    }
    const toStop = new DisposableCollection();
    toStop.pushAll([
        IDEWebSocket.connectWorkspace(),
        ideService.start(),
        gitpodServiceClient.onDidChangeInfo(() => {
            if (isWorkspaceInstancePhase('stopping') || isWorkspaceInstancePhase('stopped')) {
                toStop.dispose();
            }
        })
    ]);
    //#endregion
})();

(async () => {
    document.body.style.visibility = 'hidden';
    const [loading, gitpodServiceClient] = await Promise.all([
        LoadingFrame.load({ gitpodService: window.gitpod.service }),
        pendingGitpodServiceClient
    ]);
    const sessionId = await loading.sessionId;

    if (gitpodServiceClient.info.workspace.type !== 'regular') {
        return;
    }

    //#region current-frame
    let current: HTMLElement = loading.frame;
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
        const newCurrent = nextFrame();
        if (current === newCurrent) {
            return;
        }
        current.style.visibility = 'hidden';
        newCurrent.style.visibility = 'visible';
        if (current === document.body) {
            while (document.body.firstChild && document.body.firstChild !== newCurrent) {
                document.body.removeChild(document.body.firstChild);
            }
            while (document.body.lastChild && document.body.lastChild !== newCurrent) {
                document.body.removeChild(document.body.lastChild);
            }
        }
        current = newCurrent;
    }

    const updateLoadingState = () => {
        loading.setState({
            ideFrontendFailureCause: ideService.failureCause?.message
        });
    }
    const trackStatusRenderedEvent = (phase: string, error?: string) => {
        window.gitpod.service.server.trackEvent({
            event: "status_rendered",
            properties: {
                sessionId,
                instanceId: gitpodServiceClient.info.latestInstance?.id,
                workspaceId: gitpodServiceClient.info.workspace.id,
                type: gitpodServiceClient.info.workspace.type,
                phase,
                error,
            },
        });
    }
    const trackIDEStatusRenderedEvent = () => {
        let error: string | undefined;
        if (ideService.failureCause) {
            error = `${ideService.failureCause.message}\n${ideService.failureCause.stack}`;
        }
        trackStatusRenderedEvent(`ide-${ideService.state}`, error);
    }

    updateCurrentFrame();
    updateLoadingState();
    trackIDEStatusRenderedEvent();
    gitpodServiceClient.onDidChangeInfo(() => updateCurrentFrame());
    ideService.onDidChange(() => {
        updateLoadingState();
        updateCurrentFrame();
        trackIDEStatusRenderedEvent();
    });
    window.addEventListener('unload', () => trackStatusRenderedEvent('window-unload'), { capture: true });
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
})();