/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { JsonRpcServer } from "@theia/core";
import type { ApplicationShell } from "@theia/core/lib/browser";

export const enum GitpodTaskState {
    OPENING = 0,
    RUNNING = 1,
    CLOSED = 2,
}

export interface GitpodTask {
    id: string
    state: GitpodTaskState
    terminal?: string
    presentation: {
        name: string
        openIn?: ApplicationShell.WidgetOptions['area']
        openMode?: ApplicationShell.WidgetOptions['mode']
    }
}

export const gitpodTaskServicePath = "/services/gitpodTasks";

export const GitpodTaskServer = Symbol('GitpodTaskServer');
export interface GitpodTaskServer extends JsonRpcServer<GitpodTaskClient> {
    attach(params: AttachTaskTerminalParams): Promise<void>
}
export interface GitpodTaskClient {
    onDidChange(event: DidChangeGitpodTasksEvent): void
}

export interface DidChangeGitpodTasksEvent {
    updated: GitpodTask[]
}

export interface AttachTaskTerminalParams {
    terminalId: number
    remoteTerminal: string
}