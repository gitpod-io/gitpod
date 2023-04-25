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

export class SupervisorServiceClient {
    private static _instance: SupervisorServiceClient | undefined;
    static get(): SupervisorServiceClient {
        if (!SupervisorServiceClient._instance) {
            SupervisorServiceClient._instance = new SupervisorServiceClient();
        }
        return SupervisorServiceClient._instance;
    }

    readonly supervisorReady = this.checkReady("supervisor");
    readonly ideReady = this.supervisorReady.then(() => this.checkReady("ide"));
    readonly contentReady = Promise.all([this.supervisorReady]).then(() => this.checkReady("content"));
    readonly getWorkspaceInfoPromise = this.supervisorReady.then(() => this.getWorkspaceInfo());
    private _supervisorWillShutdown: Promise<void> | undefined;

    private constructor() {}

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
        try {
            const wsSupervisorStatusUrl = workspaceUrl.with(() => {
                return {
                    pathname: "/_supervisor/v1/status/" + kind + wait,
                };
            });
            const response = await fetch(wsSupervisorStatusUrl.toString(), { credentials: "include" });
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
