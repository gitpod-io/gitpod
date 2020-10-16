/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as util from 'util';
import { PortsStatus, PortsStatusRequest, PortsStatusResponse } from '@gitpod/supervisor-api-grpc/lib/status_pb';
import { inject, injectable, postConstruct } from 'inversify';
import { GitpodPortClient, GitpodPortServer, ExposeGitpodPortParams } from '../common/gitpod-port-server';
import { SupervisorClientProvider } from './supervisor-client-provider';
import { ExposePortRequest, ExposePortResponse } from '@gitpod/supervisor-api-grpc/lib/control_pb';

@injectable()
export class GitpodPortServerImpl implements GitpodPortServer {

    @inject(SupervisorClientProvider)
    private readonly supervisorClientProvider: SupervisorClientProvider;

    private readonly clients = new Set<GitpodPortClient>();

    private run = true;
    private stopUpdates: (() => void) | undefined;

    private ports: PortsStatus.AsObject[] = [];

    @postConstruct()
    async start(): Promise<void> {
        const client = await this.supervisorClientProvider.getStatusClient();
        while (this.run) {
            try {
                const req = new PortsStatusRequest();
                req.setObserve(true);
                const evts = client.portsStatus(req);
                this.stopUpdates = evts.cancel;

                await new Promise((resolve, reject) => {
                    evts.on('close', resolve);
                    evts.on('error', reject);
                    evts.on('data', (update: PortsStatusResponse) => {
                        const ports = this.ports = update.getPortsList().map(p => p.toObject());
                        for (const client of this.clients) {
                            client.onDidChange({ ports });
                        }
                    });
                });
            } catch (err) {
                console.error('cannot maintain connection to supervisor', err);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async getPorts(): Promise<PortsStatus.AsObject[]> {
        return this.ports;
    }

    async exposePort(params: ExposeGitpodPortParams): Promise<void> {
        const controlClient = await this.supervisorClientProvider.getControlClient();
        const request = new ExposePortRequest();
        request.setPort(params.port);
        if (params.targetPort) {
            request.setTargetPort(params.targetPort);
        }
        const response = await util.promisify<ExposePortRequest, ExposePortResponse>(controlClient.exposePort)(request);
        const error = response.getError();
        if (!error) {
            throw new Error(error)
        }
    }

    setClient(client: GitpodPortClient): void {
        this.clients.add(client);
    }
    disposeClient(client: GitpodPortClient): void {
        this.clients.delete(client);
    }

    dispose(): void {
        this.run = false;
        if (!!this.stopUpdates) {
            this.stopUpdates();
        }
    }

}