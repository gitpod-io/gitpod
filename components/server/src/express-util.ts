/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WsRequestHandler } from './express/ws-handler';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { URL } from 'url';
import * as express from 'express';
import * as crypto from 'crypto';

export const pingPong: WsRequestHandler = (ws, req, next) => {
    let pingSentTimer: any;
    const timer = setInterval(() => {
        if (ws.readyState !== ws.OPEN) {
            return;
        }
        // wait 10 secs for a pong
        pingSentTimer = setTimeout(() => {
            // Happens very often, we do not want to spam the logs here
            ws.terminate();
        }, 10000);
        ws.ping();
    }, 30000)
    ws.on('pong', () => {
        if (pingSentTimer) {
            clearTimeout(pingSentTimer);
        }
    });
    ws.on('ping', (data) => {
        // answer browser-side ping to conform RFC6455 (https://tools.ietf.org/html/rfc6455#section-5.5.2)
        ws.pong(data);
    });
    ws.on('close', () => {
        clearInterval(timer);
    })
    next();
}

export const handleError: WsRequestHandler = (ws, req, next) => {
    ws.on('error', (err: any) => {
        if (err.code !== 'ECONNRESET') {
            log.error('Websocket error', err, { ws, req });
        }
        ws.terminate();
    });
    next();
}

export const query = (...tuples: [string, string][]) => {
    if (tuples.length === 0) {
        return "";
    }
    return "?" + tuples.map(t => `${t[0]}=${encodeURIComponent(t[1])}`).join("&");
}

// We do not precise UUID parsing here, we just want to distinguish three cases:
//  - the base domain
//  - a frontend domain (workspace domain)
//  - a workspace port domain
// We control all of those values and the base domain, so we don't need to much effort
export const isAllowedWebsocketDomain = (originHeader: any, gitpodHostName: string): boolean => {
    if (!originHeader || typeof (originHeader) !== "string") {
        return false;
    }

    var originHostname = "";
    try {
        const originUrl = new URL(originHeader);
        originHostname = originUrl.hostname;
    } catch (err) {
        return false;
    }

    if (originHostname === gitpodHostName) {
        return true;
    }
    if (looksLikeWorkspaceHostname(originHeader, gitpodHostName)) {
        return true
    } else {
        return false;
    }
}

const looksLikeWorkspaceHostname = (originHostname: string, gitpodHostName: string): boolean => {
    // Is prefix a valid (looking) workspace ID?
    const found = originHostname.lastIndexOf(gitpodHostName);
    if (found === -1) {
        return false;
    }
    const prefix = originHostname.substr(0, found);
    const parts = prefix.split(".");
    if (parts.length !== 3) {
        return false;
    }

    return parts[0].split("-").length === 5;
};

export function saveSession(reqOrSession: express.Request | Express.Session): Promise<void> {
    const session = reqOrSession.session ? reqOrSession.session : reqOrSession;
    return new Promise<void>((resolve, reject) => {
        session.save((err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
export function destroySession(reqOrSession: express.Request | Express.Session): Promise<void> {
    const session = reqOrSession.session ? reqOrSession.session : reqOrSession;
    return new Promise<void>((resolve, reject) => {
        session.destroy((error: any) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For
 *
 * X-Forwarded-For: <client>, <proxy1>, <proxy2>
 *
 * @returns fingerprint which is a hash over (potential) client ip (or just proxy ip) and User Agent
 */
export function getRequestingClientInfo(req: express.Request) {
    const ip = req.ips[0] || req.ip; // on PROD this should be a client IP address
    const ua = req.get('user-agent');
    const fingerprint = crypto.createHash('sha256').update(`${ip}–${ua}`).digest('hex');
    return { ua, fingerprint };
}
