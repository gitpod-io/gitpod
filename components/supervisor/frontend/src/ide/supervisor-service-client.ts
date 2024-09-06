/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    SupervisorStatusResponse,
    IDEStatusResponse,
    ContentStatusResponse,
} from "@gitpod/supervisor-api-grpc/lib/status_pb";
import { WorkspaceInfoResponse } from "@gitpod/supervisor-api-grpc/lib/info_pb";
import { workspaceUrl } from "../shared/urls";
import { FrontendDashboardServiceClient } from "../shared/frontend-dashboard-service";
import { Timeout } from "@gitpod/gitpod-protocol/lib/util/timeout";

export class SupervisorServiceClient {
    readonly supervisorReady = this.checkReady("supervisor");
    readonly ideReady = this.supervisorReady.then(() => this.checkReady("ide"));
    readonly contentReady = Promise.all([this.supervisorReady]).then(() => this.checkReady("content"));
    readonly getWorkspaceInfoPromise = this.supervisorReady.then(() => this.getWorkspaceInfo());
    private _supervisorWillShutdown: Promise<void> | undefined;

    constructor(readonly serviceClient: FrontendDashboardServiceClient) {}

    public get supervisorWillShutdown() {
        if (!this._supervisorWillShutdown) {
            this._supervisorWillShutdown = this.supervisorReady.then(() => this.checkWillShutdown());
        }
        return this._supervisorWillShutdown;
    }

    private async checkWillShutdown(delay = false): Promise<void> {
        if (delay) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        try {
            const wsSupervisorStatusUrl = workspaceUrl.with(() => {
                return {
                    pathname: "/_supervisor/v1/status/supervisor/willShutdown/true",
                };
            });
            const response = await fetch(wsSupervisorStatusUrl.toString(), { credentials: "include" });
            let result;
            if (response.ok) {
                result = await response.json();
                if ((result as SupervisorStatusResponse.AsObject).ok) {
                    return;
                }
            }
            if (response.status === 502) {
                // bad gateway, supervisor is gone
                return;
            }
            if (response.status === 302 && response.headers.get("location")?.includes("/start/")) {
                // redirect to start page, workspace is closed
                return;
            }
            console.debug(
                `failed to check whether is about to shutdown, trying again...`,
                response.status,
                response.statusText,
                JSON.stringify(result, undefined, 2),
            );
        } catch (e) {
            // network errors
            console.debug(`failed to check whether is about to shutdown, trying again...`, e);
        }
        await this.checkWillShutdown(true);
    }

    private async checkReady(kind: "content" | "ide" | "supervisor", delay?: boolean): Promise<any> {
        if (delay) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        let wait = "/wait/true";
        if (kind == "supervisor") {
            wait = "";
        }

        // track whenever a) we are done, or b) we try to connect (again)
        const trackCheckReady = (p: { aborted?: boolean }, err?: any): void => {
            const props: Record<string, string> = {
                component: "supervisor-frontend",
                instanceId: this.serviceClient.latestInfo?.instanceId ?? "",
                userId: this.serviceClient.latestInfo?.loggedUserId ?? "",
                readyKind: kind,
            };
            if (err) {
                props.errorName = err.name;
                props.errorStack = err.message ?? String(err);
            }

            props.aborted = String(!!p.aborted);
            props.wait = wait;

            this.serviceClient.trackEvent({
                event: "supervisor_check_ready",
                properties: props,
            });
        };

        // setup a timeout, which is meant to re-establish the connection every 5 seconds
        let isError = false;
        const timeout = new Timeout(5000, () => this.serviceClient.isCheckReadyRetryEnabled());
        try {
            timeout.restart();

            const wsSupervisorStatusUrl = workspaceUrl.with(() => {
                return {
                    pathname: "/_supervisor/v1/status/" + kind + wait,
                };
            });
            const response = await fetch(wsSupervisorStatusUrl.toString(), {
                credentials: "include",
                signal: timeout.signal,
            });
            let result;
            if (response.ok) {
                result = await response.json();
                if (kind === "supervisor" && (result as SupervisorStatusResponse.AsObject).ok) {
                    return;
                }
                if (kind === "content" && (result as ContentStatusResponse.AsObject).available) {
                    return;
                }
                if (kind === "ide" && (result as IDEStatusResponse.AsObject).ok) {
                    return result;
                }
            }
            console.debug(
                `failed to check whether ${kind} is ready, trying again...`,
                response.status,
                response.statusText,
                JSON.stringify(result, undefined, 2),
            );
        } catch (e) {
            console.debug(`failed to check whether ${kind} is ready, trying again...`, e);

            // we want to track this kind of errors, as they are on the critical path (of revealing the workspace)
            isError = true;
            trackCheckReady({ aborted: timeout.signal?.aborted }, e);
        } finally {
            if (!isError) {
                // make sure we don't track twice in case of an error
                trackCheckReady({ aborted: timeout.signal?.aborted });
            }
            timeout.clear();
        }
        return this.checkReady(kind, true);
    }

    private async getWorkspaceInfo(delay?: boolean): Promise<WorkspaceInfoResponse.AsObject> {
        if (delay) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        try {
            const getWorkspaceInfoUrl = workspaceUrl.with(() => {
                return {
                    pathname: "_supervisor/v1/info/workspace",
                };
            });
            const response = await fetch(getWorkspaceInfoUrl.toString(), { credentials: "include" });
            let result;
            if (response.ok) {
                result = await response.json();
                return result;
            }
            console.debug(
                `failed to get workspace info, trying again...`,
                response.status,
                response.statusText,
                JSON.stringify(result, undefined, 2),
            );
        } catch (e) {
            console.debug(`failed to get workspace info, trying again...`, e);
        }
        return this.getWorkspaceInfo(true);
    }
}
