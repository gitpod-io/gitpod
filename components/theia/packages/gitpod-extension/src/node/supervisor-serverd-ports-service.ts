/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable, postConstruct } from "inversify";
import { ServedPortsServiceServer, ServedPort, ServedPortsServiceClient, ServedPortsChangeEvent } from "src/common/served-ports-service";
import { SupervisorClientProvider } from "./supervisor-client-provider";
import { PortsStatusRequest, PortsStatusResponse } from "@gitpod/supervisor-api-grpc/lib/status_pb";

@injectable()
export class SupervisorServedPortsServiceImpl implements ServedPortsServiceServer {
    @inject(SupervisorClientProvider) protected readonly supervisorClientProvider: SupervisorClientProvider;
    protected clients: ServedPortsServiceClient[] = [];
    protected state: ServedPort[] = [];
    protected run = true;
    protected stopUpdates: (() => void) | undefined;

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
                    evts.on("close", resolve);
                    evts.on("error", reject);
                    evts.on("data", (update: PortsStatusResponse) => {
                        const ports = this.mapFromSupervisor(update);
                        this.handlePortsUpdate(ports);
                    });
                });
            } catch (err) {
                console.error("cannot maintain connection to supervisor", err);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    protected async handlePortsUpdate(update: ServedPort[]) {
        const closed = this.state.filter(a => !update.some(b => a.internalPort === b.internalPort && a.portNumber === b.portNumber));
        const opened = update.filter(a => !this.state.some(b => a.internalPort === b.internalPort && a.portNumber === b.portNumber));
        this.state = update;
        
        const evt: ServedPortsChangeEvent = {
            didClose: closed,
            didOpen: opened,
            ports: update,
        };
        await Promise.all(this.clients.map(c => c.onServedPortsChanged(evt)));
    }

    async getOpenPorts(): Promise<ServedPort[]> {
        const req = new PortsStatusRequest();
        req.setObserve(false);
        const client = await this.supervisorClientProvider.getStatusClient();
        return await new Promise((resolve, reject) => {
            const evts = client.portsStatus(req);
            evts.on("error", reject);
            evts.on("data", (update: PortsStatusResponse) => {
                resolve(this.mapFromSupervisor(update));
            });
        })
    }

    protected mapFromSupervisor(update: PortsStatusResponse): ServedPort[] {
        return update.toObject().portsList.map(p => {
            return <ServedPort>{
                internalPort: p.globalPort,
                portNumber: p.localPort,
                served: p.globalPort === 0 ? "locally" : "globally",
            };
        });
    }

    setClient(client: ServedPortsServiceClient): void {
        this.clients.push(client);
    }

    disposeClient(client: ServedPortsServiceClient): void {
        const idx = this.clients.indexOf(client);
        if (idx > -1) {
            this.clients.splice(idx, 1);
        }
    }
    
    dispose(): void {
        this.run = false;
        if (!!this.stopUpdates) {
            this.stopUpdates();
        }
    }
    
}