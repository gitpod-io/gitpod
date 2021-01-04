/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as websocket from 'ws';
import * as express from 'express';
import { WsHandler, WsRequestHandler, WsErrorHandler, WsNextFunction, MaybePromise } from './ws-handler';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

export interface WsLayer {
    handleError: WsErrorHandler;
    handleRequest: WsRequestHandler;
    dispatch: (ws: websocket, req: express.Request) => Promise<void>;
    next: (ws: websocket, req: express.Request, err?: any) => MaybePromise;
}

export namespace WsLayer {
    export function createStack(...handlers: WsHandler[]): WsLayer {
        return handlers.reduceRight<WsLayer>((nextLayer, current) => {
            return new WsLayerImpl(current, nextLayer);
        }, DONE); // Last pseudo handler
    }
}

export class WsLayerImpl implements WsLayer {
    constructor(
        protected readonly handler: WsHandler,
        protected readonly nextLayer: WsLayer) { }

    async handleError(err: any | undefined, ws: websocket, req: express.Request, next: WsNextFunction) {
        if (this.handler.length !== 4) {
            // Is not an error handler
            return next(err);
        }
        const fn = this.handler as WsErrorHandler;

        try {
            return fn(err, ws, req, next);
        } catch (err) {
            return next(err);
        }
    }

    async handleRequest(ws: websocket, req: express.Request, next: WsNextFunction) {
        if (this.handler.length > 3) {
            // Is not a request handler
            return next();
        }
        const fn = this.handler as WsRequestHandler;

        try {
            return fn(ws, req, next);
        } catch (err) {
            log.error(err, { ws, req });
            return next(err);
        }
    }

    async dispatch(ws: websocket, req: express.Request): Promise<void> {
        try {
            return this.next(ws, req);
        } catch (err) {
            log.error(err, { ws, req });
        }
    }

    async next(ws: websocket, req: express.Request, err?: any) {
        if (err) {
            return this.handleError(err, ws, req, async (err) => this.nextLayer.next(ws, req, err));
        } else {
            return this.handleRequest(ws, req, async (err) => this.nextLayer.next(ws, req, err));
        }
    }
}

class DoneLayerImpl extends WsLayerImpl {
    handleError() { return Promise.resolve() };
    handleRequest() { return Promise.resolve() };
    dispatch() { return Promise.resolve() };
    next() { return Promise.resolve() };
}
const DONE = new DoneLayerImpl(() => { }, {} as WsLayer);
