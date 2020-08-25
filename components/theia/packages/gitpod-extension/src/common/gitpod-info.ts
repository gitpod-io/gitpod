/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { TaskConfig } from "@gitpod/gitpod-protocol";

export const gitpodInfoPath = '/services/gitpodInfoPath';

export const GitpodInfoService = Symbol('GitpodInfoService');

export interface GitpodInfoService {
    getInfo() : Promise<GitpodInfo>
    getTerminalProcessInfos(): Promise<TerminalProcessInfo[]>;
}

export interface TerminalProcessInfo {
    processId: number
    task: TaskConfig
}

export type SnapshotBucketId = string;

export interface GitpodInfo {
    workspaceId: string;
    instanceId: string;
    host: string;
    interval: number;
    repoRoot: string;
}

export namespace GitpodInfo {
    export const SERVICE_PATH = '/gitpod/info';
    export const TERMINAL_INFOS_PATH = '/gitpod/terminalnfos';
}
