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

    private readonly ports = new Map<number, PortsStatus.AsObject>();

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
                        let added: PortsStatus.AsObject[] | undefined
                        for (const port of update.getAddedList()) {
                            const object = port.toObject();
                            this.ports.set(port.getLocalPort(), object);
                            (added = added || []).push(object);
                        }
                        let updated: PortsStatus.AsObject[] | undefined
                        for (const port of update.getUpdatedList()) {
                            const object = port.toObject();
                            this.ports.set(port.getLocalPort(), object);
                            (updated = updated || []).push(object);
                        }
                        let removed: number[] | undefined
                        for (const port of update.getRemovedList()) {
                            this.ports.delete(port);
                            (removed = removed || []).push(port);
                        }
                        for (const client of this.clients) {
                            client.onDidChange({ added, updated, removed });
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
        return [...this.ports.values()];
    }

    async exposePort(params: ExposeGitpodPortParams): Promise<void> {
        const controlClient = await this.supervisorClientProvider.getControlClient();
        const request = new ExposePortRequest();
        request.setPort(params.port);
        if (params.targetPort) {
            request.setTargetPort(params.targetPort);
        }
        await util.promisify<ExposePortRequest, ExposePortResponse>(controlClient.exposePort).bind(controlClient)(request);
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