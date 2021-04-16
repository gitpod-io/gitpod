/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from 'inversify';
import { TheiaCLIService, OpenFileRequest, OpenFileResponse, OpenPreviewRequest, OpenPreviewResponse, GetGitTokenRequest, GetGitTokenResponse, GetEnvvarsRequest, GetEnvvarsResponse, SetEnvvarRequest, SetEnvvarResponse, DeleteEnvvarRequest, DeleteEnvvarResponse, IsFileOpenRequest, IsFileOpenResponse, GetPortURLRequest, GetPortURLResponse } from '../common/cli-service';
import { JsonRpcServer } from '@theia/core';
import { Deferred } from '@theia/core/lib/common/promise-util';


export const CliServiceServer = Symbol('CliServiceServer');
export interface CliServiceServer extends JsonRpcServer<TheiaCLIService>, TheiaCLIService {
    disposeClient(client: TheiaCLIService): void;
}

@injectable()
export class CliServiceServerImpl implements CliServiceServer {
    protected firstClientConnected = new Deferred<void>();
    protected clients: TheiaCLIService[] = [];

    dispose(): void {
        this.clients.length = 0;
    }

    disposeClient(client: TheiaCLIService): void {
        const index = this.clients.indexOf(client);
        if (index !== -1) {
            this.clients.splice(index, 1);
        }
    }

    setClient(client: TheiaCLIService): void {
        this.clients.push(client);
        if (this.clients.length === 1) {
            this.firstClientConnected.resolve();
        }
    }

    /**
     * Returns promise which resolves with a valid token result if provided by a client, and rejects
     * when no client provided a valid token.
     */
    async getGitToken(params: GetGitTokenRequest): Promise<GetGitTokenResponse> {
        const resultFromClient = await this.getFirstTokenFromClients(params);
        if (resultFromClient) {
            return resultFromClient;
        }
        throw new Error('No Git Token available');
    }
    protected async getFirstTokenFromClients(params: GetGitTokenRequest): Promise<GetGitTokenResponse | undefined> {
        const clients = this.clients;
        if (clients.length === 0) {
            return undefined;
        }
        return new Promise<GetGitTokenResponse>(resolve => {
            let counter = clients.length;
            const countDown = () => {
                if ((--counter) < 1) {
                    resolve(undefined);
                }
            };
            for (const client of clients) {
                client.getGitToken(params).then(result => resolve(result)).catch(countDown);
            }
        });
    }

    async openFile(params: OpenFileRequest): Promise<OpenFileResponse> {
        await this.firstClientConnected.promise;
        await Promise.all(this.clients.map(c => c.openFile(params)));
        return {};
    }

    async openPreview(params: OpenPreviewRequest): Promise<OpenPreviewResponse> {
        await this.firstClientConnected.promise;
        await Promise.all(this.clients.map(c => c.openPreview(params)));
        return {};
    }

    async getEnvVars(params: GetEnvvarsRequest): Promise<GetEnvvarsResponse> {
        await this.firstClientConnected.promise;
        return await this.clients[0].getEnvVars(params);
    }

    async setEnvVar(params: SetEnvvarRequest): Promise<SetEnvvarResponse> {
        await this.firstClientConnected.promise;
        return await this.clients[0].setEnvVar(params);
    }

    async deleteEnvVar(params: DeleteEnvvarRequest): Promise<DeleteEnvvarResponse> {
        await this.firstClientConnected.promise;
        return await this.clients[0].deleteEnvVar(params);
    }

    async isFileOpen(params: IsFileOpenRequest): Promise<IsFileOpenResponse> {
        await this.firstClientConnected.promise;
        return await this.clients[0].isFileOpen(params);
    }

    async getPortURL(params: GetPortURLRequest): Promise<GetPortURLResponse> {
        await this.firstClientConnected.promise;
        return await this.clients[0].getPortURL(params);
    }

}
