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
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";

export function timeout(millis: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, millis));
}

export class SupervisorServiceClient {
    private static _instance: SupervisorServiceClient | undefined;
    static get(): SupervisorServiceClient {
        if (!SupervisorServiceClient._instance) {
            SupervisorServiceClient._instance = new SupervisorServiceClient();
        }
        return SupervisorServiceClient._instance;
    }

    readonly supervisorReady = this.checkReady("supervisor", true, false);

    readonly ideStatus = this.supervisorReady.then(() => this.checkReady("ide", true, false));

    readonly ideReady = this.supervisorReady.then(() => this.checkReady("ide", true, true));
    readonly contentReady = this.supervisorReady.then(() => this.checkReady("content", true, true));

    private constructor() {}

    private async checkReady(kind: "content" | "ide" | "supervisor", retry?: boolean, wait?: boolean): Promise<any> {
        let waitPath = wait ? "/wait/true" : "";
        try {
            const supervisorStatusPath = "_supervisor/v1/status/" + kind + waitPath;
            const wsSupervisurStatusUrl = GitpodHostUrl.fromWorkspaceUrl(window.location.href).with((url) => {
                let pathname = url.pathname;
                if (pathname === "") {
                    pathname = "/";
                }
                pathname += supervisorStatusPath;

                return {
                    pathname,
                };
            });
            const response = await fetch(wsSupervisurStatusUrl.toString(), { credentials: "include" });
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
        return retry ? timeout(1000).then(() => this.checkReady(kind, retry, wait)) : Promise.reject();
    }
}
