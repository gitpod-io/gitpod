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
const toStop = new DisposableCollection();

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
    const supervisorServiceClient = new SupervisorServiceClient(gitpodServiceClient);
    const [ideStatus] = await Promise.all([supervisorServiceClient.ideReady, supervisorServiceClient.contentReady, loadingIDE]);
    if (isWorkspaceInstancePhase('stopping') || isWorkspaceInstancePhase('stopped')) {
        return;
    }
    toStop.pushAll([
        IDEWebSocket.connectWorkspace(),
        gitpodServiceClient.onDidChangeInfo(() => {
            if (isWorkspaceInstancePhase('stopping') || isWorkspaceInstancePhase('stopped')) {
                toStop.dispose();
            }
        })
    ]);
    const isDesktopIde = ideStatus && ideStatus.desktop && ideStatus.desktop.link;
    if (!isDesktopIde) {
        toStop.push(ideService.start());
    }
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

    const supervisorServiceClient = new SupervisorServiceClient(gitpodServiceClient);

    let hideDesktopIde = false;
    const serverOrigin = startUrl.url.origin;
    const hideDesktopIdeEventListener = (event: MessageEvent) => {
        if (event.origin === serverOrigin && event.data.type == 'openBrowserIde') {
            window.removeEventListener('message', hideDesktopIdeEventListener);
            hideDesktopIde = true;
            toStop.push(ideService.start());
        }
    }
    window.addEventListener('message', hideDesktopIdeEventListener, false);
    toStop.push({ dispose: () => window.removeEventListener('message', hideDesktopIdeEventListener) });

    //#region gitpod browser telemetry
    window.addEventListener("message", async (event) => {
        const type = event.data.type;
        if (type === "vscode_telemetry") {
            const { event: eventName, properties } = event.data;
            window.gitpod.service.server.trackEvent({
                event: eventName,
                properties: {
                    sessionId,
                    instanceId: gitpodServiceClient.info.latestInstance?.id,
                    workspaceId: gitpodServiceClient.info.workspace.id,
                    type: gitpodServiceClient.info.workspace.type,
                    ...properties,
                },
            });
        }
    })
    //#endregion

    type DesktopIDEStatus = { link: string, label: string, clientID?: string, kind?: String }
    let isDesktopIde: undefined | boolean = undefined;
    let ideStatus: undefined | { desktop: DesktopIDEStatus } = undefined;

    //#region current-frame
    let current: HTMLElement = loading.frame;
    let desktopRedirected = false;
    let currentInstanceId = "";
    const nextFrame = () => {
        const instance = gitpodServiceClient.info.latestInstance;
        if (instance) {
            // refresh web page when instanceId changed
            if (currentInstanceId !== "") {
                if (instance.id !== currentInstanceId && instance.ideUrl !== "") {
                    currentInstanceId = instance.id;
                    window.location.href = instance.ideUrl;
                }
            } else {
                currentInstanceId = instance.id;
            }
            if (instance.status.phase === 'running') {
                if (!hideDesktopIde) {
                    if (isDesktopIde == undefined) {
                        return loading.frame;
                    }
                    if (isDesktopIde && !!ideStatus) {
                        trackDesktopIDEReady(ideStatus.desktop);
                        loading.setState({
                            desktopIdeLink: ideStatus.desktop.link,
                            desktopIdeLabel: ideStatus.desktop.label || "Open Desktop IDE",
                            desktopIdeClientID: ideStatus.desktop.clientID,
                        });
                        if (!desktopRedirected) {
                            desktopRedirected = true;
                            try {
                                const desktopLink = new URL(ideStatus.desktop.link)
                                // redirect only if points to desktop application
                                // don't navigate browser to another page
                                if (desktopLink.protocol != 'http:' && desktopLink.protocol != 'https:') {
                                    window.location.href = ideStatus.desktop.link;
                                }
                            } catch (e) {
                                console.error('invalid desktop link:', e)
                            }
                        }
                        return loading.frame;
                    }
                }
                if (ideService.state === 'ready') {
                    return document.body;
                }
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
    const trackStatusRenderedEvent = (phase: string, properties?: {
        [prop: string]: any
    }) => {
        window.gitpod.service.server.trackEvent({
            event: "status_rendered",
            properties: {
                sessionId,
                instanceId: gitpodServiceClient.info.latestInstance?.id,
                workspaceId: gitpodServiceClient.info.workspace.id,
                type: gitpodServiceClient.info.workspace.type,
                phase,
                ...properties
            },
        });
    }
    let trackedDesktopIDEReady = false;
    const trackDesktopIDEReady = ({ clientID, kind }: DesktopIDEStatus) => {
        if (trackedDesktopIDEReady) {
            return;
        }
        trackedDesktopIDEReady = true
        trackStatusRenderedEvent('desktop-ide-ready', { clientID, kind });
    }
    const trackIDEStatusRenderedEvent = () => {
        let error: string | undefined;
        if (ideService.failureCause) {
            error = `${ideService.failureCause.message}\n${ideService.failureCause.stack}`;
        }
        trackStatusRenderedEvent(`ide-${ideService.state}`, { error });
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
    supervisorServiceClient.ideReady.then(newIdeStatus => {
        ideStatus = newIdeStatus;
        isDesktopIde = !!ideStatus && !!ideStatus.desktop && !!ideStatus.desktop.link;
        updateCurrentFrame();
    }).catch(error => console.error(`Unexpected error from supervisorServiceClient.ideReady: ${error}`));
    window.addEventListener('unload', () => trackStatusRenderedEvent('window-unload'), { capture: true });
    //#endregion

    //#region heart-beat
    heartBeat.track(window);
    const updateHeartBeat = () => {
        if (gitpodServiceClient.info.latestInstance?.status.phase === 'running') {
            heartBeat.schedule(gitpodServiceClient.info, sessionId);
        } else {
            heartBeat.cancel();
        }
    }
    updateHeartBeat();
    gitpodServiceClient.onDidChangeInfo(() => updateHeartBeat());
    //#endregion
})();
