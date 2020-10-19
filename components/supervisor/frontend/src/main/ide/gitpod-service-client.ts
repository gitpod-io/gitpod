/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceInfo, Event, Emitter } from "@gitpod/gitpod-protocol";
import { workspaceUrl, serverUrl } from "../shared/urls";

export interface GitpodServiceClient {
    readonly auth: Promise<void>;
    readonly info: WorkspaceInfo;
    readonly onDidChangeInfo: Event<void>;
}

export async function create(): Promise<GitpodServiceClient> {
    if (!workspaceUrl.workspaceId) {
        throw new Error(`Failed to extract a workspace id from '${window.location.href}'.`);
    }

    //#region info
    let info = await window.gitpod.service.server.getWorkspace(workspaceUrl.workspaceId);
    const onDidChangeEmitter = new Emitter<void>();

    async function updateInfo(): Promise<void> {
        info = await window.gitpod.service.server.getWorkspace(info.workspace.id);
        onDidChangeEmitter.fire();
    }
    updateInfo();
    window.gitpod.service.server.onDidOpenConnection(updateInfo);
    window.document.addEventListener('visibilitychange', async () => {
        if (window.document.visibilityState === 'visible') {
            updateInfo();
        }
    });
    window.gitpod.service.registerClient({
        onInstanceUpdate: instance => {
            if (instance.workspaceId === info.workspace.id) {
                info.latestInstance = instance;
                onDidChangeEmitter.fire();
            }
        }
    });
    //#endregion

    //#region auth
    let resolveAuth: () => void;
    let rejectAuth: (reason?: any) => void;
    const _auth = new Promise<void>((resolve, reject) => {
        resolveAuth = resolve
        rejectAuth = reject
    });
    async function auth(workspaceInstanceId: string): Promise<void> {
        if (document.cookie.includes(`${workspaceInstanceId}_owner_`)) {
            resolveAuth!();
            return;
        }
        try {
            const response = await fetch(serverUrl.asWorkspaceAuth(workspaceInstanceId).toString(), {
                credentials: 'include'
            });
            if (response.ok) {
                resolveAuth!();
            } else {
                rejectAuth!(new Error('authentication failed'));
            }
        } catch (e) {
            rejectAuth!(e);
        }
    }
    if (info.latestInstance) {
        auth(info.latestInstance.id);
    } else {
        const authListener = onDidChangeEmitter.event(() => {
            if (info.latestInstance) {
                authListener.dispose();
                auth(info.latestInstance.id);
            }
        });
    }
    //#endregion

    return {
        get auth() { return _auth },
        get info() { return info },
        onDidChangeInfo: onDidChangeEmitter.event
    }
}