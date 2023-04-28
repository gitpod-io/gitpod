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

@injectable()
export class SessionHandlerProvider {
    @inject(Config) protected readonly config: Config;
    @inject(DBConfig) protected readonly dbConfig: DBConfig;
    @inject(AuthJWT) protected readonly authJWT: AuthJWT;

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
            let hasJWTCookie = false;

            const cookies = parseCookieHeader(req.headers.cookie || "");
            const jwtToken = cookies[SessionHandlerProvider.getJWTCookieName(this.config)];
            if (jwtToken) {
                // we handle the verification async, because we don't yet need to use it in the application
                /* tslint:disable-next-line */
                this.authJWT
                    .verify(jwtToken)
                    .then((claims) => {
                        log.debug("JWT Session token verified", {
                            claims,
                        });
                        hasJWTCookie = true;
                    })
                    .catch((err) => {
                        log.error("Failed to verify JWT Session token", err);
                    })
                    .finally(() => {
                        reportSessionWithJWT(hasJWTCookie);
                    });
            }

            session(options)(req, res, next);
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
