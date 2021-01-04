/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PortVisibility } from '@gitpod/gitpod-protocol';
import type { PortsStatus, ExposedPortInfo } from '@gitpod/supervisor-api-grpc/lib/status_pb';
import { Emitter } from '@theia/core/lib/common/event';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { inject, injectable, postConstruct } from 'inversify';
import { GitpodPortServer, ExposeGitpodPortParams, DidChangeGitpodPortsEvent } from '../../common/gitpod-port-server';
import { getWorkspaceID } from '../utils';
import { GitpodServiceProvider } from '../gitpod-service-provider';
import { MaybePromise } from '@theia/core/lib/common/types';

export interface ExposedServedPort extends PortsStatus.AsObject {
    served: true
    exposed: ExposedPortInfo.AsObject
}
export function isExposedServedPort(port: PortsStatus.AsObject | undefined): port is ExposedServedPort {
    return !!port?.exposed && !!port.served;
}

@injectable()
export class GitpodPortsService {

    private readonly _ports = new Map<number, PortsStatus.AsObject>();

    private readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    private readonly onDidExposeServedPortEmitter = new Emitter<ExposedServedPort>();
    readonly onDidExposeServedPort = this.onDidExposeServedPortEmitter.event;

    @inject(GitpodPortServer)
    private readonly server: GitpodPortServer;

    private readonly workspaceID = getWorkspaceID()

    @inject(GitpodServiceProvider)
    private readonly serviceProvider: GitpodServiceProvider;

    @postConstruct()
    protected init(): void {
        // register client before connection is opened
        this.server.setClient({
            onDidChange: event => this.updatePorts(event)
        });
    }

    get ports(): IterableIterator<PortsStatus.AsObject> {
        return this._ports.values();
    }

    private updatePorts({ ports }: DidChangeGitpodPortsEvent): void {
        const toClean = new Set<number>(this._ports.keys());
        if (ports !== undefined) {
            for (const port of ports) {
                toClean?.delete(port.localPort)

                const current = this._ports.get(port.localPort);
                this._ports.set(port.localPort, port);
                
                if (isExposedServedPort(port) && !isExposedServedPort(current)) {
                    this.onDidExposeServedPortEmitter.fire(port);
                }
            }
        }
        for (const port of toClean) {
            this._ports.delete(port);
        }
        this.onDidChangeEmitter.fire();
    }

    exposePort(params: ExposeGitpodPortParams): MaybePromise<string> {
        const existing = this._ports.get(params.port);
        if (existing?.exposed) {
            return existing.exposed.url;
        }
        const pendingExposePort = new Deferred<string>();
        const listener = this.onDidChange(() => {
            const port = this._ports.get(params.port);
            if (port?.exposed) {
                listener.dispose();
                pendingExposePort.resolve(port.exposed.url);
            }
        })
        this.server.exposePort(params).catch(pendingExposePort.reject)
        return pendingExposePort.promise;
    }

    async setVisibility(port: PortsStatus.AsObject, visibility: PortVisibility): Promise<void> {
        await this.serviceProvider.getService().server.openPort(this.workspaceID, {
            port: port.localPort,
            targetPort: port.globalPort,
            visibility
        });
    }

}