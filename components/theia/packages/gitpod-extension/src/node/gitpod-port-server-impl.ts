/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as util from 'util';
import { PortsStatus, PortsStatusRequest, PortsStatusResponse } from '@gitpod/supervisor-api-grpc/lib/status_pb';
import { inject, injectable, postConstruct } from 'inversify';
import { GitpodPortClient, GitpodPortServer, ExposeGitpodPortParams } from '../common/gitpod-port-server';
import { SupervisorClientProvider } from './supervisor-client-provider';
import { ExposePortRequest, ExposePortResponse } from '@gitpod/supervisor-api-grpc/lib/control_pb';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { JsonRpcProxy } from '@gitpod/gitpod-protocol/lib/messaging/proxy-factory';

@injectable()
export class GitpodPortServerImpl implements GitpodPortServer {

    @inject(SupervisorClientProvider)
    private readonly supervisorClientProvider: SupervisorClientProvider;

    private readonly clients = new Set<GitpodPortClient>();

    private run = true;
    private stopUpdates: (() => void) | undefined;

    private readonly ports = new Map<number, PortsStatus.AsObject>();
    private readonly deferredReady = new Deferred<void>();

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
                        this.ports.clear();
                        let ports: PortsStatus.AsObject[] = [];
                        for (const port of update.getPortsList()) {
                            const object = port.toObject();
                            this.ports.set(port.getLocalPort(), object);
                            ports.push(object);
                        }
                        for (const client of this.clients) {
                            client.onDidChange({ ports });
                        }
                        this.deferredReady.resolve();
                    });
                });
            } catch (err) {
                console.error('cannot maintain connection to supervisor', err);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
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

    setClient(client: JsonRpcProxy<GitpodPortClient>): void {
        let closed = false;
        this.deferredReady.promise.then(() => {
            if (closed) {
                return;
            }
            this.clients.add(client);
            client.onDidChange({
                ports: [...this.ports.values()]
            })
        });
        client.onDidCloseConnection(() => {
            closed = true;
            this.clients.delete(client);
        });
    }

    dispose(): void {
        this.run = false;
        if (!!this.stopUpdates) {
            this.stopUpdates();
        }
    }

}