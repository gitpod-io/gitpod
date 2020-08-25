/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Disposable, Emitter, Event, JsonRpcServer } from "@theia/core";
import { inject, postConstruct, injectable } from "inversify";
import { PortVisibility } from "@gitpod/gitpod-protocol";

export type PortServedState = 'globally' | 'locally';

export interface ServedPort {
    portNumber: number;
    internalPort: number;

    /**
     * A globally exposed port is bound to either the docker veth device or 0.0.0.0.
     * A locally exposed port is bound to the loopback device only.
     */
    served: PortServedState;
}

export interface ServedPortsChangeEvent {
    ports: ServedPort[];
    didOpen: ServedPort[];
    didClose: ServedPort[];
}

export interface ExposedPort {
    port: number;

    served: PortServedState | 'not-served';
    exposed: boolean;
    visibility?: PortVisibility;
}

export const ServedPortsServiceClient = Symbol('ServedPortsServiceClient');
export interface ServedPortsServiceClient {
    onServedPortsChanged(event: ServedPortsChangeEvent): Promise<void>;
}

export const ServedPortsServiceServer = Symbol('ServedPortsServiceServer');
export interface ServedPortsServiceServer extends JsonRpcServer<ServedPortsServiceClient> {
    getOpenPorts(): Promise<ServedPort[]>;
    isPortReady(port: number): Promise<boolean>;
    waitUntilPortIsReady(port: number, timeoutMillis: number): Promise<boolean>;
    disposeClient(client: ServedPortsServiceClient): void;
}

@injectable()
export class ServedPortsService implements ServedPortsServiceClient, Disposable {

    @inject(ServedPortsServiceServer) private readonly server: ServedPortsServiceServer;

    protected readonly onServedPortsChangeEventEmitter = new Emitter<ServedPortsChangeEvent>();
    readonly onServedPortsChangeEvent: Event<ServedPortsChangeEvent> = this.onServedPortsChangeEventEmitter.event;

    @postConstruct()
    init(): void {
        this.server.setClient({ onServedPortsChanged: e => this.onServedPortsChanged(e) });
    }

    async getServedPorts() {
        return this.server.getOpenPorts();
    }

    async onServedPortsChanged(event: ServedPortsChangeEvent): Promise<void> {
        this.onServedPortsChangeEventEmitter.fire(event);
    }

    async isPortReady(port: number): Promise<boolean> {
        return this.server.isPortReady(port);
    }

    async waitUntilPortIsReady(port: number, timeoutMillis: number): Promise<boolean> {
        return this.server.waitUntilPortIsReady(port, timeoutMillis);
    }

    dispose(): void {
        this.onServedPortsChangeEventEmitter.dispose();
    }
}

export namespace ServedPortsService {
    export const SERVICE_PATH = '/services/served-ports-service';
}
