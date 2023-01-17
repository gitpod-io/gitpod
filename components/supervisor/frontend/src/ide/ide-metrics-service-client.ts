/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { serverUrl, workspaceUrl } from "../shared/urls";
import { GitpodServiceClient } from "./gitpod-service-client";
const commit = require("../../config.json").commit;

export enum MetricsName {
    SupervisorFrontendClientTotal = "gitpod_supervisor_frontend_client_total",
    SupervisorFrontendErrorTotal = "gitpod_supervisor_frontend_error_total",
    SupervisorFrontendLoadTotal = "gitpod_vscode_web_load_total",
}

const MetricsUrl = serverUrl.asIDEMetrics().toString();

interface AddCounterParam {
    value?: number;
    labels?: Record<string, string>;
}

interface ReportErrorParam {
    workspaceId: string;
    instanceId: string;
    errorStack: string;
    userId: string;
    component: string;
    version: string;
    properties?: Record<string, string>;
}
export class IDEMetricsServiceClient {
    static workspaceId = workspaceUrl.workspaceId;
    static debugWorkspace = workspaceUrl.debugWorkspace;
    static gitpodServiceClient?: GitpodServiceClient;

    static get instanceId(): string {
        return this.gitpodServiceClient?.info.latestInstance?.id ?? "";
    }
    static get userId(): string {
        return this.gitpodServiceClient?.user.id ?? "";
    }

    static async addCounter(
        metricsName: MetricsName,
        labels?: Record<string, string>,
        value?: number,
    ): Promise<boolean> {
        const url = `${MetricsUrl}/metrics/counter/add/${metricsName}`;
        const params: AddCounterParam = { value, labels };
        try {
            const response = await fetch(url, {
                method: "POST",
                body: JSON.stringify(params),
                credentials: "omit",
            });
            if (!response.ok) {
                const data = await response.json(); // { code: number; message: string; }
                console.error(`Cannot report metrics with addCounter: ${response.status} ${response.statusText}`, data);
                return false;
            }
            return true;
        } catch (err) {
            console.error("Cannot report metrics with addCounter, error:", err);
            return false;
        }
    }

    static async reportError(error: Error, properties?: Record<string, string>): Promise<boolean> {
        const p = Object.assign({}, properties);
        p.error_name = error.name;
        p.error_message = error.message;
        p.debug_workspace = String(this.debugWorkspace);

        const url = `${MetricsUrl}/reportError`;
        const params: ReportErrorParam = {
            errorStack: error.stack ?? String(error),
            component: "supervisor-frontend",
            version: commit,
            workspaceId: this.workspaceId ?? "",
            instanceId: this.instanceId,
            userId: this.userId,
            properties: p,
        };
        try {
            const response = await fetch(url, {
                method: "POST",
                body: JSON.stringify(params),
                credentials: "omit",
            });
            if (!response.ok) {
                const data = await response.json();
                console.error(`Cannot report error: ${response.status} ${response.statusText}`, data);
                return false;
            }
            return true;
        } catch (err) {
            console.error("Cannot report errorr, error:", err);
            return false;
        }
    }

    static loadWorkspaceInfo(gitpodServiceClient: GitpodServiceClient) {
        this.gitpodServiceClient = gitpodServiceClient;
    }
}
