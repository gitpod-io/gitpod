/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

 import * as express from 'express';
 import * as websocket from 'ws';
import { Disposable, DisposableCollection } from "@gitpod/gitpod-protocol";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { WsNextFunction, WsRequestHandler } from './ws-handler';

/**
 * This class provides a websocket handler that manages ping-pong behavior for all incoming websocket requests.
 * Clients that to not respond in time are terminated.
 */
export class WsConnectionHandler implements Disposable {

    protected readonly disposables: DisposableCollection = new DisposableCollection();
    protected readonly clients: Set<websocket> = new Set();

    start(): void {
        // implement heartbeating closely following https://www.npmjs.com/package/ws#how-to-detect-and-close-broken-connections
        const INTERVAL = 30000;
        const TIMEOUT = INTERVAL;
        const CLOSING_TIMEOUT = INTERVAL;
        const timer = repeat(async () => {
            log.debug("ws connection handler", { clients: this.clients.size });
            this.clients.forEach((ws) => {
                try {
                    switch (ws.readyState) {
                        case websocket.CLOSED:
                            // ws should not be in the clients list anymore, but still happens:
                            // we rely on a 'close' event being generated, but never receive it. At the same time, the readyState is 'CLOSED' (3).
                            // judging from the ws source code, this might only happen if an earlier registered handler throws an (unhandled) error.
                            log.warn("websocket in strange state", { readyState: ws.readyState });

                            // the following is a hack trying to mitigate the effects of leaking CLOSED websockets
                            if (process.env.EXPERIMENTAL_WS_TERMINATION) {
                                try {
                                    (ws as any).emitClose();
                                    log.warn("websocket (experimental): close emitted");
                                } catch (err) {
                                    log.error("websocket (experimental): error on emit('close')", err);
                                }
                            }
                            return;
                        case websocket.CONNECTING:
                            // ws should not be in the clients list, yet
                            log.warn("websocket in strange state", { readyState: ws.readyState });
                            return;
                        case websocket.CLOSING:
                            const closingTimestamp = getOrSetClosingTimestamp(ws);
                            if (closingTimestamp + CLOSING_TIMEOUT <= Date.now()) {
                                log.warn("websocket in CLOSING state for too long, terminating.");
                                ws.terminate();
                                return;
                            }
                            log.warn("websocket in CLOSING state, giving it a last chance...");
                            return;
                    }

                    const pingSent = getPingSent(ws);
                    if (pingSent) {
                        const pongReceived = getPongReceived(ws) || 0;
                        if (!(pingSent < pongReceived && pongReceived <= pingSent + TIMEOUT)) {
                            ws.terminate();
                            return;
                        }
                    }
                    // if no ping was sent, yet, this is a fresh ws connection


                    // note: decoupling by using `setImmediate` in order to offload to the following event loop iteration.
                    setImmediate(() => {
                        try {
                            ws.ping();  // if this fails it triggers a ws error, and fails the ws anyway
                            setPingSent(ws, Date.now());
                        } catch (err) {
                            log.error("websocket ping error", err);
                        }
                    });
                } catch (err) {
                    log.error("websocket ping-pong error", err);
                }
            });
        }, INTERVAL);
        this.disposables.push(timer);
    }

    handler(): WsRequestHandler {
        return (ws: websocket, req: express.Request, next: WsNextFunction) => {
            // maintain set of clients
            this.clients.add(ws);
            ws.on('close', () => this.clients.delete(ws));

            // setup ping-pong
            ws.on('pong', () => {
                setPongReceived(ws, Date.now());
            });
            ws.on('ping', (data: any) => {
                // answer browser-side ping to conform RFC6455 (https://tools.ietf.org/html/rfc6455#section-5.5.2)
                // note: decoupling by using `setImmediate` in order to offload to the following event loop iteration.
                setImmediate(() => {
                    try {
                        ws.pong(data);
                    } catch (err) {
                        log.error("websocket pong error", err);
                    }
                });
            });

            // error handling
            ws.on('error', (err: any) => {
                if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {    // exclude very common errors
                    log.warn('websocket error, closing.', err, { ws, req });
                }
                ws.close(); // ws should trigger close() itself on any socket error. We do this just to be sure.
            });

            next();
        };
    }

    dispose(): void {
        this.disposables.dispose();
    }
}

function setPongReceived(ws: websocket, timestamp: number = Date.now()) {
    (ws as any).pongReceived = timestamp;
}

function setPingSent(ws: websocket, timestamp: number = Date.now()) {
    (ws as any).pingSent = timestamp;
}

function getPongReceived(ws: websocket): number | undefined {
    return (ws as any).pongReceived;
}

function getPingSent(ws: websocket): number | undefined {
    return (ws as any).pingSent;
}

function getOrSetClosingTimestamp(ws: websocket, timestamp: number = Date.now()): number {
    return (ws as any).closingTimestamp = (ws as any).closingTimestamp || timestamp;
}