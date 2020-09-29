/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceInfoResponse } from "@gitpod/supervisor-api-grpc/lib/info_pb";

const checkReady: (kind: 'content' | 'ide' | 'supervisor') => Promise<void> = kind =>
    fetch(window.location.protocol + '//' + window.location.host + '/_supervisor/v1/status/' + kind + '/wait/true', { credentials: 'include' }).then(response => {
        if (response.ok) {
            return;
        }
        console.debug(`failed to check whether ${kind} is ready, trying again...`, response.status, response.statusText);
        return checkReady(kind);
    }, e => {
        console.debug(`failed to check whether ${kind} is ready, trying again...`, e);
        return checkReady(kind);
    });
export const supervisorReady = checkReady('supervisor');
export const ideReady = supervisorReady.then(() => checkReady('ide'));
export const contentReady = supervisorReady.then(() => checkReady('content'));

export const fetchWorkspaceInfo = (async () => {
    await supervisorReady;
    const response = await fetch(window.location.protocol + '//' + window.location.host + '/_supervisor/v1/info/workspace', { credentials: 'include' });
    const result = await response.json();
    return result as WorkspaceInfoResponse.AsObject;
});
