/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import WebSocket from "ws";
import express from "express";
import * as http from "http";
import * as https from "https";
import * as url from "url";
import * as net from "net";
import { WsLayer } from "./ws-layer";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { increaseHttpRequestCounter } from "../prometheus-metrics";
import { Disposable } from "vscode-ws-jsonrpc";
import { DisposableCollection } from "@gitpod/gitpod-protocol";

export type HttpServer = http.Server | https.Server;
export type RouteMatcher = string | RegExp;
export type MaybePromise = Promise<any> | any;

export interface WsNextFunction {
    (err?: any): MaybePromise;
}
export interface WsRequestHandler {
    (ws: WebSocket, req: express.Request, next: WsNextFunction): MaybePromise;
}
export interface WsErrorHandler {
    (err: any | undefined, ws: WebSocket, req: express.Request, next: WsNextFunction): MaybePromise;
}
export type WsHandler = WsRequestHandler | WsErrorHandler;

export type WsConnectionFilter = WebSocket.VerifyClientCallbackAsync | WebSocket.VerifyClientCallbackSync;

interface Route {
    matcher: RouteMatcher;
    handler: (ws: WebSocket, req: express.Request) => void;
}

export class WsExpressHandler implements Disposable {
    protected readonly wss: WebSocket.Server;
    protected readonly routes: Route[] = [];
    private disposables = new DisposableCollection();

    constructor(protected readonly httpServer: HttpServer, protected readonly verifyClient?: WsConnectionFilter) {
        this.wss = new WebSocket.Server({
            verifyClient,
            noServer: true,
            // disabling to reduce memory consumption, cf.
            // https://github.com/websockets/ws#websocket-compression
            perMessageDeflate: false,
            // we don't use this feature, so avoid having another potential mem leak
            clientTracking: false,
        });
        this.wss.on("error", (err) => {
            log.error("websocket server error", err, { wss: this.wss });
        });
        this.wss.on("connection", (ws) => {
            const cancelTerminate = this.disposables.push(Disposable.create(() => ws.close()));
            ws.on("close", () => {
                cancelTerminate.dispose();
            });
        });
        this.httpServer.on("upgrade", (req: http.IncomingMessage, socket: net.Socket, head: Buffer) =>
            this.onUpgrade(req, socket, head),
        );
    }

    dispose(): void {
        this.wss.close((err) => {
            if (err) {
                log.error("websocket server close error", err, { wss: this.wss });
            }
        });
        this.disposables.dispose();
    }

    ws(
        matcher: RouteMatcher,
        handler: (ws: WebSocket, request: express.Request) => void,
        ...handlers: WsHandler[]
    ): void {
        const stack = WsLayer.createStack(...handlers);
        const dispatch = (ws: WebSocket, request: express.Request) => {
            handler(ws, request);
            stack
                .dispatch(ws, request)
                .finally(() => {
                    const pathname = request.url ? url.parse(request.url).pathname : undefined;
                    const method = request.method || "UNKNOWN";
                    increaseHttpRequestCounter(method, pathname || "unkown-websocket", request.statusCode || 0);
                })
                .catch((err) => {
                    log.error("websocket stack error", err);
                    ws.terminate();
                });
        };

        this.routes.push({
            matcher,
            handler: (ws, req) => {
                if (ws.readyState === ws.OPEN) {
                    dispatch(ws, req);
                } else {
                    ws.on("open", () => dispatch(ws, req));
                }
            },
        });
    }

    protected onUpgrade(request: http.IncomingMessage, socket: net.Socket, head: Buffer) {
        const pathname = request.url ? url.parse(request.url).pathname : undefined;
        for (const route of this.routes) {
            if (this.matches(route.matcher, pathname)) {
                this.wss.handleUpgrade(request, socket, head, (ws) => route.handler(ws, request as express.Request));
                return; // take the first match and stop
            }
        }
    }

    protected matches(matcher: RouteMatcher, pathname: string | undefined | null): boolean {
        if (matcher instanceof RegExp) {
            return !!pathname && matcher.test(pathname);
        }
        return pathname === matcher;
    }
}
