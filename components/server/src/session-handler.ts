/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as express from "express";
import * as session from "express-session";
import { SessionOptions } from "express-session";
import { v4 as uuidv4 } from "uuid";
import { injectable, inject, postConstruct } from "inversify";

import * as mysqlstore from "express-mysql-session";
const MySQLStore = mysqlstore(session);
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Config as DBConfig } from "@gitpod/gitpod-db/lib/config";
import { Config } from "./config";
import { reportSessionWithJWT } from "./prometheus-metrics";
import { AuthJWT } from "./auth/jwt";
import { UserDB } from "@gitpod/gitpod-db/lib";

@injectable()
export class SessionHandlerProvider {
    @inject(Config) protected readonly config: Config;
    @inject(DBConfig) protected readonly dbConfig: DBConfig;
    @inject(AuthJWT) protected readonly authJWT: AuthJWT;
    @inject(UserDB) protected userDb: UserDB;

    public sessionHandler: express.RequestHandler;

    @postConstruct()
    public init() {
        const options: SessionOptions = {} as SessionOptions;
        options.cookie = this.getCookieOptions(this.config);
        (options.genid = function (req: any) {
            return uuidv4(); // use UUIDs for session IDs
        }),
            (options.name = SessionHandlerProvider.getCookieName(this.config));
        // options.proxy = true    // TODO SSL Proxy
        options.resave = true; // TODO Check with store! See docu
        options.rolling = true; // default, new cookie and maxAge
        options.secret = this.config.session.secret;
        options.saveUninitialized = false; // Do not save new cookie without content (uninitialized)

        options.store = this.createStore();

        this.sessionHandler = (req, res, next) => {
            const cookies = parseCookieHeader(req.headers.cookie || "");
            const jwtToken = cookies[SessionHandlerProvider.getJWTCookieName(this.config)];
            if (jwtToken) {
                // we handle the verification async, because we don't yet need to use it in the application
                /* tslint:disable-next-line */
                this.jwtSessionHandler(jwtToken, req, res, next)
                    // the jwtSessionHandler is self-contained with respect to handling errors
                    // however, if we did miss any, we at least capture it in here.
                    .catch((err) => {
                        log.error("Failed authenticate user with JWT Session cookie", err);
                        res.statusCode = 500;
                        res.send("Failed to authenticate jwt session.");
                    });
            } else {
                session(options)(req, res, next);
            }
        };
    }

    protected async jwtSessionHandler(
        jwtToken: string,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ): Promise<void> {
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
        const name = SessionHandlerProvider.getCookieName(config);
        const options = { ...this.getCookieOptions(config) };
        delete options.expires;
        delete options.maxAge;
        res.clearCookie(name, options);

        res.clearCookie(SessionHandlerProvider.getJWTCookieName(this.config));
    }

    protected createStore(): any | undefined {
        const options = {
            ...(this.dbConfig.dbConfig as any),
            user: this.dbConfig.dbConfig.username,
            database: "gitpod-sessions",
            createDatabaseTable: true,
        };
        return new MySQLStore(options, undefined, (err) => {
            if (err) {
                log.debug("MySQL session store error: ", err);
            }
        });
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
