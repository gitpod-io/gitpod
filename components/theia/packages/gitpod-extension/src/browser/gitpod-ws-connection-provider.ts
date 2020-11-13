/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WebSocketConnectionProvider } from "@theia/core/lib/browser";
import { inject, injectable, postConstruct } from "inversify";
import ReconnectingWebSocket from 'reconnecting-websocket';
import { GitpodServiceProvider } from "./gitpod-service-provider";
import { getWorkspaceID } from "./utils";

/**
 * Avoids reconnecting when the workspace is not running.
 */
@injectable()
export class GitpodWebSocketConnectionProvider extends WebSocketConnectionProvider {

    @inject(GitpodServiceProvider) protected readonly serviceProvider: GitpodServiceProvider;

    constructor() {
        super();
        const name = 'gipod-theia-ws';
        const startMarker = name + '-start';
        const endMarker = name + '-end';

        performance.clearMeasures(name);
        performance.clearMarks(startMarker);
        performance.clearMarks(endMarker);

        performance.mark(startMarker);
        const measure = () => {
            this.socket.removeEventListener('open', measure);

            performance.mark(endMarker);
            performance.measure(name, startMarker, endMarker);

            const entries = performance.getEntriesByName(name);
            const duration = entries.length > 0 ? entries[0].duration : Number.NaN;

            performance.clearMeasures(name);
            performance.clearMarks(startMarker);
            performance.clearMarks(endMarker);
            if (duration === Number.NaN) {
                // Measurement was prevented by native API, do not log NaN duration
                return;
            }

            console.log(`Turning on theia websocket first time took: ${duration.toFixed(1)} ms`);
        }
        this.socket.addEventListener('open', measure);
    }

    protected shouldReconnect: boolean = false;

    protected setShouldReconnect(connect: boolean) {
        if (this.shouldReconnect === connect) {
            return;
        }
        console.log('Turning theia websocket reconnecting ' + (connect ? 'on' : 'off'));
        this.shouldReconnect = connect;
        if (this.socket) {
            if (connect) {
                this.socket.reconnect();
            } else {
                this.socket.close();
            }
        }
    }

    @postConstruct()
    protected async init(): Promise<void> {
        const service = this.serviceProvider.getService();
        const listener = await service.listenToInstance(getWorkspaceID());
        const update = () => {
            this.setShouldReconnect(listener.info.latestInstance?.status.phase === 'running');
        }
        update();
        listener.onDidChange(() => update());
    }

    protected createWebSocket(url: string): ReconnectingWebSocket {
        const websocket = new ReconnectingWebSocket(url, undefined, {
            maxReconnectionDelay: 10000,
            minReconnectionDelay: 1000,
            reconnectionDelayGrowFactor: 1.3,
            connectionTimeout: 10000,
            maxRetries: Infinity,
            debug: false,
            startClosed: !this.shouldReconnect
        });
        return websocket;
    }
}