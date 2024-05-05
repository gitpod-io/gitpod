/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Disposable } from "@gitpod/gitpod-protocol";
import { WatchWorkspaceStatusCallback, watchWorkspaceStatus } from "./listen-to-workspace-ws-messages";

const cachedCallbackInfoMap = new Map<string, { complete: WatchWorkspaceStatusCallback; priority: number }[]>();
const cachedDisposables = new Map<string, Disposable>();

export enum WatchWorkspaceStatusPriority {
    StartWorkspacePage = 100,
    SupervisorService = 50,
}

/**
 * Registers multiple callbacks to receive the same workspace status update in order of priority.
 *
 * @param workspaceId The workspace ID to watch. If undefined, all workspaces are watched.
 * @param priority The priority of the callback. Higher priority callbacks are executed and waited first.
 * @param callback The callback to execute when a workspace status update is received. Only executed after previous callbacks.
 */
export function watchWorkspaceStatusInOrder(
    workspaceId: string | undefined,
    priority: WatchWorkspaceStatusPriority,
    callback: WatchWorkspaceStatusCallback,
): Disposable {
    const wsID = workspaceId || "ALL_WORKSPACES";
    const newInfo = { complete: callback, priority };
    const callbacks = cachedCallbackInfoMap.get(wsID) ?? [];
    callbacks.push(newInfo);
    callbacks.sort((a, b) => b.priority - a.priority);

    if (!cachedDisposables.has(wsID)) {
        const disposable = watchWorkspaceStatus(wsID, async (response) => {
            const list = cachedCallbackInfoMap.get(wsID);
            if (!list) {
                return;
            }
            for (const info of list) {
                await info.complete(response);
            }
        });
        cachedDisposables.set(wsID, disposable);
    }
    cachedCallbackInfoMap.set(wsID, callbacks);
    return Disposable.create(() => {
        const currentCallbacks = cachedCallbackInfoMap.get(wsID)?.filter((info) => info !== newInfo) ?? [];
        cachedCallbackInfoMap.set(wsID, currentCallbacks);
        // Dispose the watcher if no more callbacks are registered
        if (currentCallbacks.length === 0) {
            cachedDisposables.get(wsID)?.dispose();
            cachedDisposables.delete(wsID);
            cachedCallbackInfoMap.delete(wsID);
        }
    });
}
