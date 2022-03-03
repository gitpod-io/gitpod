/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceInfo, Event, Emitter } from '@gitpod/gitpod-protocol';
import { workspaceUrl } from '../shared/urls';

export interface GitpodServiceClient {
    readonly auth: Promise<void>;
    readonly info: WorkspaceInfo;
    readonly onDidChangeInfo: Event<void>;
}

export async function create(): Promise<GitpodServiceClient> {
    const wsUrl = workspaceUrl;
    if (!wsUrl.workspaceId) {
        throw new Error(`Failed to extract a workspace id from '${wsUrl.toString()}'.`);
    }

    //#region info
    const listener = await window.gitpod.service.listenToInstance(wsUrl.workspaceId);
    //#endregion

    //#region auth
    let resolveAuth: () => void;
    let rejectAuth: (reason?: any) => void;
    const _auth = new Promise<void>((resolve, reject) => {
        resolveAuth = resolve;
        rejectAuth = reject;
    });
    async function auth(workspaceInstanceId: string): Promise<void> {
        try {
            const response = await fetch(wsUrl.asStart().asWorkspaceAuth(workspaceInstanceId).toString(), {
                credentials: 'include',
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
    if (listener.info.latestInstance) {
        auth(listener.info.latestInstance.id);
    } else {
        const authListener = listener.onDidChange(() => {
            if (listener.info.latestInstance) {
                authListener.dispose();
                auth(listener.info.latestInstance.id);
            }
        });
    }
    //#endregion

    return {
        get auth() {
            return _auth;
        },
        get info() {
            return listener.info;
        },
        onDidChangeInfo: listener.onDidChange,
    };
}
