/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export const gitpodInfoPath = '/services/gitpodInfoPath';

export const GitpodInfoService = Symbol('GitpodInfoService');

export interface GitpodInfoService {
    getInfo() : Promise<GitpodInfo>
}

export interface GitpodInfo {
    workspaceId: string;
    instanceId: string;
    host: string;
    interval: number;
    repoRoot: string;
}
