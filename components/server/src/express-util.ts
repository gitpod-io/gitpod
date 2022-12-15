/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { URL } from "url";
import * as express from "express";
import * as crypto from "crypto";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import * as session from "express-session";

export const query = (...tuples: [string, string][]) => {
    if (tuples.length === 0) {
        return "";
    }
    return "?" + tuples.map((t) => `${t[0]}=${encodeURIComponent(t[1])}`).join("&");
};

// We do not precise UUID parsing here, we just want to distinguish three cases:
//  - the base domain
//  - a frontend domain (workspace domain)
//  - a workspace port domain
// We control all of those values and the base domain, so we don't need to much effort
export const isAllowedWebsocketDomain = (originHeader: any, gitpodHostName: string): boolean => {
    if (!originHeader || typeof originHeader !== "string") {
        return false;
    }

    var originHostname = "";
    try {
        const originUrl = new URL(originHeader);
        originHostname = originUrl.hostname;
        if (originHostname === gitpodHostName) {
            return true;
        }
        if (looksLikeWorkspaceHostname(originUrl, gitpodHostName)) {
            return true;
        } else {
            return false;
        }
    } catch (err) {
        return false;
    }
};

const looksLikeWorkspaceHostname = (originHostname: URL, gitpodHostName: string): boolean => {
    // Is prefix a valid (looking) workspace ID?
    const found = originHostname.toString().lastIndexOf(gitpodHostName);
    if (found === -1) {
        return false;
    }
    const url = new GitpodHostUrl(originHostname);
    const workspaceId = url.workspaceId;
    if (workspaceId) {
        const hostname = url.url.hostname as string;
        if (hostname.startsWith(workspaceId)) {
            return true;
        }
    }
    return false;
};

export function saveSession(session: session.Session): Promise<void> {
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
export function destroySession(session: session.Session): Promise<void> {
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
    const ip = clientIp(req);
    const ua = req.get("user-agent");
    const fingerprint = crypto.createHash("sha256").update(`${ip}–${ua}`).digest("hex");
    return { ua, fingerprint };
}

/**
 * Catches exceptions from an async handler and puts them back into the express handler chain.
 * Assumes handlers take care of regular forwarding themselves.
 *
 * @param handler
 * @returns
 */
export function asyncHandler(
    handler: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>,
): express.Handler {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        handler(req, res, next).catch((err) => next(err));
    };
}

/**
 * Turns all unhandled requests into an error
 * @param req
 * @param res
 * @param next
 * @returns
 */
export function unhandledToError(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (isAnsweredRequest(req, res)) {
        return next();
    }
    return next(new Error("unhandled request: " + req.method + " " + req.originalUrl));
}

/**
 * Logs all errors, and responds unanswered requests.
 * @param log
 */
export function bottomErrorHandler(log: (...args: any[]) => void): express.ErrorRequestHandler {
    return (err: any, req: express.Request, response: express.Response, next: express.NextFunction) => {
        if (!err) {
            return next();
        }

        let msg = "undefined";
        let status = 500;
        if (err instanceof Error) {
            msg = err.toString() + "\nStack: " + err.stack;
            status = typeof (err as any).status === "number" ? (err as any).status : 500;
        } else {
            msg = err.toString();
        }
        log({ sessionId: req.sessionID }, err, {
            originalUrl: req.originalUrl,
            headers: req.headers,
            cookies: req.cookies,
            session: req.session,
        });
        if (!isAnsweredRequest(req, response)) {
            response.status(status).send({ error: msg });
        }
    };
}

export function isAnsweredRequest(req: express.Request, res: express.Response) {
    return res.headersSent || req.originalUrl.endsWith(".websocket");
}

export const takeFirst = (h: string | string[] | undefined): string | undefined => {
    if (Array.isArray(h)) {
        if (h.length < 1) {
            return undefined;
        }
        return h[0];
    }
    return h;
};

export function clientIp(req: express.Request): string | undefined {
    const forwardedFor = takeFirst(req.headers["x-forwarded-for"]);
    if (!forwardedFor) {
        return undefined;
    }

    // We now have a ,-separated string of IPs, where the first one is the (closest to) client IP
    return forwardedFor.split(",")[0];
}
