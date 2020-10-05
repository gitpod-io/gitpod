/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceInfoResponse } from "@gitpod/supervisor-api-grpc/lib/info_pb";

export class SupervisorServiceClient {
    readonly supervisorReady = this.checkReady('supervisor');
    readonly ideReady = this.supervisorReady.then(() => this.checkReady('ide'))
    readonly contentReady = this.supervisorReady.then(() => this.checkReady('content'));

    async fetchWorkspaceInfo(): Promise<WorkspaceInfoResponse.AsObject> {
        await this.supervisorReady;
        const response = await fetch(window.location.protocol + '//' + window.location.host + '/_supervisor/v1/info/workspace', { credentials: 'include' });
        const result = await response.json();
        return result as WorkspaceInfoResponse.AsObject;
    }

    private async checkReady(kind: 'content' | 'ide' | 'supervisor', delay?: boolean): Promise<void> {
        if (delay) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        let wait = "/wait/true";
        if (kind == "supervisor") {
            wait = "";
        }
        return fetch(window.location.protocol + '//' + window.location.host + '/_supervisor/v1/status/' + kind + wait, { credentials: 'include' }).then(response => {
            if (response.ok) {
                return;
            }
            console.debug(`failed to check whether ${kind} is ready, trying again...`, response.status, response.statusText);
            return this.checkReady(kind, true);
        }, e => {
            console.debug(`failed to check whether ${kind} is ready, trying again...`, e);
            return this.checkReady(kind, true);
        });
    }

}