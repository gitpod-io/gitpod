/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/**
 * <script type="text/javascript" src="/_supervisor/frontend/main.js" charset="utf-8"></script> should be inserted to index.html as first body script,
 * all other IDE scripts should go afterwards, head element should not have scripts
 */

import { IDEMetricsServiceClient, MetricsName } from "./ide/ide-metrics-service-client";
IDEMetricsServiceClient.addCounter(MetricsName.SupervisorFrontendClientTotal).catch(() => {});

//#region supervisor frontend error capture
function isElement(obj: any): obj is Element {
    return typeof obj.getAttribute === "function";
}

window.addEventListener("error", (event) => {
    const labels: Record<string, string> = {};
    let resourceSource: string | null | undefined;
    if (isElement(event.target)) {
        // We take a look at what is the resource that was attempted to load;
        resourceSource = event.target.getAttribute("src") || event.target.getAttribute("href");
        // If the event has a `target`, it means that it wasn't a script error
        if (resourceSource) {
            if (resourceSource.match(new RegExp(/\/build\/ide\/code:.+\/__files__\//g))) {
                // TODO(ak) reconsider how to hide knowledge of VS Code from supervisor frontend, i.e instrument amd loader instead
                labels["resource"] = "vscode-web-workbench";
            }
            labels["error"] = "LoadError";
        }
    }
    if (event.error) {
        IDEMetricsServiceClient.reportError(event.error).catch(() => {});
    } else if (labels["error"] == "LoadError") {
        let error = new Error("LoadError");
        IDEMetricsServiceClient.reportError(error, {
            resource: labels["resource"],
            url: resourceSource ?? "",
        }).catch(() => {});
    }
    IDEMetricsServiceClient.addCounter(MetricsName.SupervisorFrontendErrorTotal, labels).catch(() => {});
});
//#endregion

require("../src/shared/index.css");

import { WorkspaceInstancePhase } from "@gitpod/gitpod-protocol";
import { DisposableCollection } from "@gitpod/gitpod-protocol/lib/util/disposable";
import * as heartBeat from "./ide/heart-beat";
import * as IDEFrontendService from "./ide/ide-frontend-service-impl";
import * as IDEWorker from "./ide/ide-worker";
import * as IDEWebSocket from "./ide/ide-web-socket";
import { SupervisorServiceClient } from "./ide/supervisor-service-client";
import * as LoadingFrame from "./shared/loading-frame";
import { workspaceUrl } from "./shared/urls";

window.gitpod = {} as any;
IDEWorker.install();
IDEWebSocket.install();
const ideService = IDEFrontendService.create();
const loadingIDE = new Promise((resolve) => window.addEventListener("DOMContentLoaded", resolve, { once: true }));
const toStop = new DisposableCollection();
let willRedirect = false;

document.body.style.visibility = "hidden";
LoadingFrame.load().then(async (loading) => {
    const frontendDashboardServiceClient = loading.frontendDashboardServiceClient;
    await frontendDashboardServiceClient.initialize();

    if (frontendDashboardServiceClient.latestInfo.workspaceType !== "regular") {
        return;
    }

    frontendDashboardServiceClient.onWillRedirect(() => {
        willRedirect = true;
    });

    document.title = frontendDashboardServiceClient.latestInfo.workspaceDescription ?? "gitpod";
    window.gitpod.loggedUserID = frontendDashboardServiceClient.latestInfo.loggedUserId;
    window.gitpod.openDesktopIDE = frontendDashboardServiceClient.openDesktopIDE.bind(frontendDashboardServiceClient);
    window.gitpod.decrypt = frontendDashboardServiceClient.decrypt.bind(frontendDashboardServiceClient);
    window.gitpod.encrypt = frontendDashboardServiceClient.encrypt.bind(frontendDashboardServiceClient);
    window.gitpod.isEncryptedData = frontendDashboardServiceClient.isEncryptedData.bind(frontendDashboardServiceClient);

    const supervisorServiceClient = new SupervisorServiceClient(frontendDashboardServiceClient);

    (async () => {
        let hideDesktopIde = false;
        const hideDesktopIdeEventListener = frontendDashboardServiceClient.onOpenBrowserIDE(() => {
            hideDesktopIdeEventListener.dispose();
            hideDesktopIde = true;
            toStop.push(ideService.start());
        });
        toStop.push(hideDesktopIdeEventListener);

        //#region gitpod browser telemetry
        // TODO(ak) get rid of it
        // it is bad usage of window.postMessage
        // VS Code should use Segment directly here and publish to production/staging untrusted
        // supervisor frontend should not care about IDE specifics
        window.addEventListener("message", async (event) => {
            const type = event.data.type;
            if (type === "vscode_telemetry") {
                const { event: eventName, properties } = event.data;
                frontendDashboardServiceClient.trackEvent({
                    event: eventName,
                    properties,
                });
            }
        });
        //#endregion

        type DesktopIDEStatus = { link: string; label: string; clientID?: string; kind?: String };
        let isDesktopIde: undefined | boolean = undefined;
        let ideStatus: undefined | { desktop: DesktopIDEStatus } = undefined;

        //#region current-frame
        let current: HTMLElement = loading.frame;
        let desktopRedirected = false;
        let currentInstanceId = "";
        const nextFrame = () => {
            const { instanceId, ideUrl, statusPhase } = frontendDashboardServiceClient.latestInfo ?? {};

            if (instanceId) {
                // refresh web page when instanceId changed
                if (currentInstanceId !== "") {
                    if (instanceId !== currentInstanceId && ideUrl !== "") {
                        currentInstanceId = instanceId;
                        window.location.href = ideUrl!;
                    }
                } else {
                    currentInstanceId = instanceId;
                }
                if (statusPhase === "running") {
                    if (!hideDesktopIde) {
                        if (isDesktopIde == undefined) {
                            return loading.frame;
                        }
                        if (isDesktopIde && !!ideStatus) {
                            trackDesktopIDEReady(ideStatus.desktop);
                            frontendDashboardServiceClient.setState({
                                desktopIDE: {
                                    link: ideStatus.desktop.link,
                                    label: ideStatus.desktop.label || "Open Desktop IDE",
                                    clientID: ideStatus.desktop.clientID!,
                                },
                            });
                            if (!desktopRedirected) {
                                desktopRedirected = true;
                                frontendDashboardServiceClient.openDesktopIDE(ideStatus.desktop.link);
                            }
                            return loading.frame;
                        }
                    }
                    if (ideService.state === "ready") {
                        return document.body;
                    }
                }
            }
            return loading.frame;
        };
        const updateCurrentFrame = () => {
            const newCurrent = nextFrame();
            if (current === newCurrent || willRedirect) {
                return;
            }
            current.style.visibility = "hidden";
            newCurrent.style.visibility = "visible";
            if (current === document.body) {
                while (document.body.firstChild && document.body.firstChild !== newCurrent) {
                    document.body.removeChild(document.body.firstChild);
                }
                while (document.body.lastChild && document.body.lastChild !== newCurrent) {
                    document.body.removeChild(document.body.lastChild);
                }
            }
            current = newCurrent;
        };

        const updateLoadingState = () => {
            frontendDashboardServiceClient.setState({
                ideFrontendFailureCause: ideService.failureCause?.message,
            });
        };
        const trackStatusRenderedEvent = (
            phase: string,
            properties?: {
                [prop: string]: any;
            },
        ) => {
            frontendDashboardServiceClient.trackEvent({
                event: "status_rendered",
                properties: {
                    phase,
                    ...properties,
                },
            });
        };
        let trackedDesktopIDEReady = false;
        const trackDesktopIDEReady = ({ clientID, kind }: DesktopIDEStatus) => {
            if (trackedDesktopIDEReady) {
                return;
            }
            trackedDesktopIDEReady = true;
            trackStatusRenderedEvent("desktop-ide-ready", { clientID, kind });
        };
        const trackIDEStatusRenderedEvent = () => {
            let error: string | undefined;
            if (ideService.failureCause) {
                error = `${ideService.failureCause.message}\n${ideService.failureCause.stack}`;
            }
            trackStatusRenderedEvent(`ide-${ideService.state}`, { error });
        };

        updateCurrentFrame();
        updateLoadingState();
        trackIDEStatusRenderedEvent();
        frontendDashboardServiceClient.onInfoUpdate(() => updateCurrentFrame());
        ideService.onDidChange(() => {
            updateLoadingState();
            updateCurrentFrame();
            trackIDEStatusRenderedEvent();
        });
        supervisorServiceClient.ideReady
            .then((newIdeStatus) => {
                ideStatus = newIdeStatus;
                isDesktopIde = !!ideStatus && !!ideStatus.desktop && !!ideStatus.desktop.link;
                updateCurrentFrame();
            })
            .catch((error) => console.error(`Unexpected error from supervisorServiceClient.ideReady: ${error}`));
        window.addEventListener("unload", () => trackStatusRenderedEvent("window-unload"), { capture: true });
        //#endregion

        //#region heart-beat
        heartBeat.track(window);
        let isOwner = false;
        supervisorServiceClient.getWorkspaceInfoPromise.then((info) => {
            isOwner = frontendDashboardServiceClient.latestInfo.loggedUserId === info.ownerId;
            updateHeartBeat();
        });
        const updateHeartBeat = () => {
            if (frontendDashboardServiceClient.latestInfo?.statusPhase === "running" && isOwner) {
                heartBeat.schedule(frontendDashboardServiceClient);
            } else {
                heartBeat.cancel();
            }
        };
        updateHeartBeat();
        frontendDashboardServiceClient.onInfoUpdate(() => updateHeartBeat());
        //#endregion
    })();

    (async () => {
        const debugWorkspace = workspaceUrl.debugWorkspace;
        //#region ide lifecycle
        function isWorkspaceInstancePhase(phase: WorkspaceInstancePhase): boolean {
            return frontendDashboardServiceClient.latestInfo?.statusPhase === phase;
        }
        if (!isWorkspaceInstancePhase("running")) {
            if (debugWorkspace && frontendDashboardServiceClient.latestInfo) {
                window.open("", "_self")?.close();
            }
            await new Promise<void>((resolve) => {
                frontendDashboardServiceClient.onInfoUpdate((status) => {
                    if (status.statusPhase === "running") {
                        resolve();
                    }
                });
            });
        }
        if (debugWorkspace) {
            supervisorServiceClient.supervisorWillShutdown.then(() => {
                window.open("", "_self")?.close();
            });
        }
        const [ideStatus] = await Promise.all([
            supervisorServiceClient.ideReady,
            supervisorServiceClient.contentReady,
            loadingIDE,
        ]);
        if (isWorkspaceInstancePhase("stopping") || isWorkspaceInstancePhase("stopped")) {
            return;
        }
        toStop.pushAll([
            IDEWebSocket.connectWorkspace(),
            frontendDashboardServiceClient.onInfoUpdate((status) => {
                if (status.statusPhase === "stopping" || status.statusPhase === "stopped") {
                    toStop.dispose();
                }
            }),
        ]);
        const isDesktopIde = ideStatus && ideStatus.desktop && ideStatus.desktop.link;
        if (!isDesktopIde) {
            toStop.push(ideService.start());
        }
        //#endregion
    })();
});
