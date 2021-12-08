/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as websocket from 'ws';
import * as express from 'express';
import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
import * as net from 'net';
import { WsLayer } from './ws-layer';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { increaseHttpRequestCounter } from '../prometheus-metrics';

export type HttpServer = http.Server | https.Server;
export type Route = string | RegExp;
export type MaybePromise = Promise<any> | any;

export interface WsNextFunction {
    (err?: any): MaybePromise;
}
export interface WsRequestHandler {
    (ws: websocket, req: express.Request, next: WsNextFunction): MaybePromise;
}
export interface WsErrorHandler {
    (err: any | undefined, ws: websocket, req: express.Request, next: WsNextFunction): MaybePromise;
}
export type WsHandler = WsRequestHandler | WsErrorHandler;

export type WsConnectionFilter = websocket.VerifyClientCallbackAsync | websocket.VerifyClientCallbackSync;


export class WsExpressHandler {

    protected readonly wss: websocket.Server;

    constructor(
            protected readonly httpServer: HttpServer,
            protected readonly verifyClient?: WsConnectionFilter) {
        this.wss = new websocket.Server({
            verifyClient,
            noServer: true,
            perMessageDeflate: {
                // don't compress if a message is less than 256kb
                threshold: 256 * 1024
            },
            // we don't use this feature, so avoid having another potential mem leak
            clientTracking: false,
        });
        this.wss.on('error', (err) => {
            log.error('Websocket error', err, { ws: this.wss });
        });
    }

    ws(route: Route, handler: (ws: websocket, request: express.Request) => void, ...handlers: WsHandler[]): void {
        const stack = WsLayer.createStack(...handlers);
        const dispatch = (ws: websocket, request: express.Request) => {
            handler(ws, request);
            stack.dispatch(ws, request).catch(err => {
                log.error("websocket stack error", err);
                ws.terminate();
            }).finally(() => {
                const pathname = request.url ? url.parse(request.url).pathname : undefined;
                const method = request.method || "UNKNOWN";
                increaseHttpRequestCounter(method, pathname || "unkown-websocket", request.statusCode || 0);
            });
        }

        this.httpServer.on('upgrade', (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
            const pathname = request.url ? url.parse(request.url).pathname : undefined;
            if (this.matches(route, pathname)) {
                this.wss.handleUpgrade(request, socket, head, ws => {
                    if (ws.readyState === ws.OPEN) {
                        dispatch(ws, request as express.Request);
                    } else {
                        ws.on('open', () => dispatch(ws, request as express.Request));
                    }
                });
            }
        });
    }

    protected matches(route: Route, pathname: string | undefined | null): boolean {
        if (route instanceof RegExp) {
            return !!pathname && route.test(pathname);
        }
        return pathname === route;
    }
}
