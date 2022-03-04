/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { SupervisorStatusResponse, IDEStatusResponse, ContentStatusResponse } from '@gitpod/supervisor-api-grpc/lib/status_pb'
import { GitpodServiceClient } from './gitpod-service-client';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';

export class SupervisorServiceClient {
    readonly supervisorReady = this.checkReady('supervisor');
    readonly ideReady = this.supervisorReady.then(() => this.checkReady('ide'))
    readonly contentReady = Promise.all([
        this.supervisorReady,
        this.gitpodServiceClient.auth
    ]).then(() => this.checkReady('content'));

    constructor(
        private readonly gitpodServiceClient: GitpodServiceClient
    ) { }

    private async checkReady(kind: 'content' | 'ide' | 'supervisor', delay?: boolean): Promise<any> {
        if (delay) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        let wait = "/wait/true";
        if (kind == "supervisor") {
            wait = "";
        }
        try {
            const supervisorStatusPath = "_supervisor/v1/status/" + kind + wait;
            const wsSupervisurStatusUrl = GitpodHostUrl.fromWorkspaceUrl(window.location.href)
                .with(url => {
                    let pathname = url.pathname;
                    if (pathname === "") {
                        pathname = "/";
                    }
                    pathname += supervisorStatusPath;

                    return {
                        pathname
                    };
                });
            const response = await fetch(wsSupervisurStatusUrl.toString(), { credentials: 'include' });
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
                    return result;
                }
            }
            console.debug(`failed to check whether ${kind} is ready, trying again...`, response.status, response.statusText, JSON.stringify(result, undefined, 2));
        } catch (e) {
            console.debug(`failed to check whether ${kind} is ready, trying again...`, e);
        }
        return this.checkReady(kind, true);
    }

}