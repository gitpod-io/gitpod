/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as express from "express";
import * as websocket from "ws";
import { injectable, inject, postConstruct } from "inversify";

import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Config as DBConfig } from "@gitpod/gitpod-db/lib/config";
import { Config } from "./config";
import { reportJWTCookieIssued, reportSessionWithJWT } from "./prometheus-metrics";
import { AuthJWT } from "./auth/jwt";
import { UserDB } from "@gitpod/gitpod-db/lib";
import { WsNextFunction } from "./express/ws-handler";

@injectable()
export class SessionHandler {
    @inject(Config) protected readonly config: Config;
    @inject(DBConfig) protected readonly dbConfig: DBConfig;
    @inject(AuthJWT) protected readonly authJWT: AuthJWT;
    @inject(UserDB) protected userDb: UserDB;

    public sessionHandler: express.RequestHandler;

    @postConstruct()
    public init() {
        this.sessionHandler = (req, res, next) => {
            this.jwtSessionHandler(req, res, next)
                // the jwtSessionHandler is self-contained with respect to handling errors
                // however, if we did miss any, we at least capture it in here.
                .catch((err) => {
                    log.error("Failed authenticate user with JWT Session cookie", err);
                    res.statusCode = 500;
                    res.send("Failed to authenticate jwt session.");
                });
        };
    }

    public jwtSessionConvertor(): express.Handler {
        return async (req, res) => {
            const user = req.user;
            if (!user) {
                res.status(401);
                res.send("User has no valid session.");
                return;
            }

            const cookies = parseCookieHeader(req.headers.cookie || "");
            const jwtToken = cookies[SessionHandler.getJWTCookieName(this.config)];
            if (!jwtToken) {
                const cookie = await this.createJWTSessionCookie(user.id);

                res.cookie(cookie.name, cookie.value, cookie.opts);

                reportJWTCookieIssued();
                res.status(200);
                res.send("New JWT cookie issued.");
            } else {
                try {
                    // will throw if the token is expired
                    const decoded = await this.authJWT.verify(jwtToken);

                    const issuedAtMs = (decoded.iat || 0) * 1000;
                    const now = new Date();
                    const thresholdMs = 60 * 60 * 1000; // 1 hour

                    // Was the token issued more than threshold ago?
                    if (issuedAtMs + thresholdMs < now.getTime()) {
                        // issue a new one, to refresh it
                        const cookie = await this.createJWTSessionCookie(user.id);
                        res.cookie(cookie.name, cookie.value, cookie.opts);

                        reportJWTCookieIssued();
                        res.status(200);
                        res.send("Refreshed JWT cookie issued.");
                        return;
                    }

                    res.status(200);
                    res.send("User session already has a valid JWT session.");
                } catch (err) {
                    res.status(401);
                    res.send("JWT Session is invalid");
                    return;
                }
            }
        };
    }

    public async websocket(ws: websocket, req: express.Request, next: WsNextFunction): Promise<void> {
        const cookies = parseCookieHeader(req.headers.cookie || "");
        const jwtToken = cookies[SessionHandler.getJWTCookieName(this.config)];

        if (!jwtToken) {
            log.debug("No JWT session present on request");

            ws.emit("error", "Request is not authenticated - no JWT session present on request.");
            ws.terminate();
            return;
        }

        try {
            const claims = await this.authJWT.verify(jwtToken);
            log.debug("JWT Session token verified", {
                claims,
            });

            const subject = claims.sub;
            if (!subject) {
                throw new Error("Subject is missing from JWT session claims");
            }

            const user = await this.userDb.findUserById(subject);
            if (!user) {
                throw new Error("No user exists.");
            }

            // We set the user object on the request to signal the user is authenticated.
            // Passport uses the `user` property on the request to determine if the session
            // is authenticated.
            req.user = user;

            // Trigger the next middleware in the chain.
            next();
        } catch (err) {
            log.warn("Failed to authenticate websocket with JWT Session", err);
            // Remove the existing cookie, to force the user to re-sing in, and hence refresh it

            ws.emit("error", "Request is did not contain valid credentials - invalid JWT on request.");
            ws.terminate();
            // Redirect the user to an error page
            return;
        } finally {
            reportSessionWithJWT(true);
        }
    }

    protected async jwtSessionHandler(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ): Promise<void> {
        const cookies = parseCookieHeader(req.headers.cookie || "");
        const jwtToken = cookies[SessionHandler.getJWTCookieName(this.config)];
        if (!jwtToken) {
            log.debug("No JWT session present on request");
            // Remove the existing cookie, to force the user to re-sing in, and hence refresh it
            this.clearSessionCookie(res, this.config);

            // Redirect the user to an error page
            res.redirect(this.config.hostUrl.asSorry("No credentials present on request, please sign-in.").toString());
            return;
        }

        try {
            const claims = await this.authJWT.verify(jwtToken);
            log.debug("JWT Session token verified", {
                claims,
            });

            const subject = claims.sub;
            if (!subject) {
                throw new Error("Subject is missing from JWT session claims");
            }

            const user = await this.userDb.findUserById(subject);
            if (!user) {
                throw new Error("No user exists.");
            }

            // We set the user object on the request to signal the user is authenticated.
            // Passport uses the `user` property on the request to determine if the session
            // is authenticated.
            req.user = user;

            // Trigger the next middleware in the chain.
            next();
        } catch (err) {
            log.warn("Failed to authenticate user with JWT Session", err);
            // Remove the existing cookie, to force the user to re-sing in, and hence refresh it
            this.clearSessionCookie(res, this.config);

            // Redirect the user to an error page
            res.redirect(this.config.hostUrl.asSorry(err).toString());
        } finally {
            reportSessionWithJWT(true);
        }
    }

    public async createJWTSessionCookie(
        userID: string,
    ): Promise<{ name: string; value: string; opts: express.CookieOptions }> {
        const token = await this.authJWT.sign(userID, {});

        return {
            name: SessionHandler.getJWTCookieName(this.config),
            value: token,
            opts: {
                maxAge: this.config.auth.session.cookie.maxAge * 1000, // express does not match the HTTP spec and uses milliseconds
                httpOnly: this.config.auth.session.cookie.httpOnly,
                sameSite: this.config.auth.session.cookie.sameSite,
                secure: this.config.auth.session.cookie.secure,
            },
        };
    }

    protected getCookieOptions(config: Config): express.CookieOptions {
        // ############################################################################################################
        // WARNING: Whenever we do changes here, we very likely want to have bump the cookie name as well!
        // ############################################################################################################
        // Do not set `domain` attribute so only the base domain (e.g. only gitpod.io) has the Gitpod cookie.
        // If `domain` is specified, then subdomains are always included. Therefore, specifying `domain` is less restrictive than omitting it.
        return {
            path: "/", // default
            httpOnly: true, // default
            secure: false, // default, TODO SSL! Config proxy
            maxAge: config.session.maxAgeMs,
            sameSite: "lax", // default: true. "Lax" needed for OAuth.
        };
    }

    static getCookieName(config: Config) {
        const derived = config.hostUrl
            .toString()
            .replace(/https?/, "")
            .replace(/[\W_]+/g, "_");
        return `${derived}v2_`;
    }

    static getJWTCookieName(config: Config) {
        return config.auth.session.cookie.name;
    }

    public clearSessionCookie(res: express.Response, config: Config): void {
        // http://expressjs.com/en/api.html#res.clearCookie
        const name = SessionHandler.getCookieName(config);
        const options = { ...this.getCookieOptions(config) };
        delete options.expires;
        delete options.maxAge;
        res.clearCookie(name, options);

        res.clearCookie(SessionHandler.getJWTCookieName(this.config), options);
    }
}

function parseCookieHeader(cookie: string): { [key: string]: string } {
    return cookie
        .split("; ")
        .map((keypair) => keypair.split("="))
        .reduce<{ [key: string]: string }>((aggregator, vals) => {
            const [key, value] = vals;
            aggregator[key] = value;
            return aggregator;
        }, {});
}
