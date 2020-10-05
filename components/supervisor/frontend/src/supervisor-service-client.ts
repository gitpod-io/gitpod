/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { SupervisorStatusResponse, IDEStatusResponse, ContentStatusResponse } from '@gitpod/supervisor-api-grpc/lib/status_pb'

export class SupervisorServiceClient {
    readonly supervisorReady = this.checkReady('supervisor');
    readonly ideReady = this.supervisorReady.then(() => this.checkReady('ide'))
    readonly contentReady = this.supervisorReady.then(() => this.checkReady('content'));

    private async checkReady(kind: 'content' | 'ide' | 'supervisor', delay?: boolean): Promise<void> {
        if (delay) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        let wait = "/wait/true";
        if (kind == "supervisor") {
            wait = "";
        }
        try {
            const response = await fetch(window.location.protocol + '//' + window.location.host + '/_supervisor/v1/status/' + kind + wait, { credentials: 'include' });
            let result;
            if (response.ok) {
                result = await response.json();
                if (kind === 'supervisor' && (result as SupervisorStatusResponse.AsObject).ok) {
                    return;
                }
                if (kind === 'content' && (result as ContentStatusResponse.AsObject).available) {
                    return;
                }
                if (kind === 'ide' && (result as IDEStatusResponse.AsObject).ok) {
                    return;
                }
            }
            console.debug(`failed to check whether ${kind} is ready, trying again...`, response.status, response.statusText, JSON.stringify(result, undefined, 2));
        } catch (e) {
            console.debug(`failed to check whether ${kind} is ready, trying again...`, e);
        }
        return this.checkReady(kind, true);
    }

}