/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceInfo, Event, Emitter } from "@gitpod/gitpod-protocol";
import { workspaceUrl } from "./urls";

export interface GitpodServiceClient {
    readonly info: WorkspaceInfo;
    readonly onDidChangeInfo: Event<void>;
}

export async function create(): Promise<GitpodServiceClient> {
    if (!workspaceUrl.workspaceId) {
        throw new Error(`Failed to extract a workspace id from '${window.location.href}'.`);
    }

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

    return {
        get info() { return info },
        onDidChangeInfo: onDidChangeEmitter.event
    }
}