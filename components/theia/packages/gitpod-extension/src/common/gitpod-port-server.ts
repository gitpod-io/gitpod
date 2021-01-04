/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import type { PortsStatus } from '@gitpod/supervisor-api-grpc/lib/status_pb';
import { JsonRpcServer } from '@theia/core';

export const gitpodPortServicePath = '/services/gitpodPorts';

export const GitpodPortServer = Symbol('GitpodPortServer');
export interface GitpodPortServer extends JsonRpcServer<GitpodPortClient> {
    exposePort(params: ExposeGitpodPortParams): Promise<void>;
}

export interface GitpodPortClient {
    onDidChange(event: DidChangeGitpodPortsEvent): void;
}

export interface DidChangeGitpodPortsEvent {
    ports: PortsStatus.AsObject[]
}

export interface ExposeGitpodPortParams {
    port: number
    targetPort?: number
}