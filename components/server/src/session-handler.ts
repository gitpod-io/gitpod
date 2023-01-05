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

@injectable()
export class SessionHandlerProvider {
    @inject(Config) protected readonly config: Config;
    @inject(DBConfig) protected readonly dbConfig: DBConfig;

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

        this.sessionHandler = session(options);
    }

    protected getCookieOptions(config: Config): express.CookieOptions {
        return {
            path: "/", // default
            httpOnly: true, // default
            secure: false, // default, TODO SSL! Config proxy
            maxAge: config.session.maxAgeMs, // configured in Helm chart, defaults to 3 days.
            sameSite: "lax", // default: true. "Lax" needed for OAuth.
        };
    }

    static getCookieName(config: Config) {
        return config.hostUrl
            .toString()
            .replace(/https?/, "")
            .replace(/[\W_]+/g, "_");
    }

    public clearSessionCookie(res: express.Response, config: Config): void {
        // http://expressjs.com/en/api.html#res.clearCookie
        const name = SessionHandlerProvider.getCookieName(config);
        const options = { ...this.getCookieOptions(config) };
        delete options.expires;
        delete options.maxAge;
        res.clearCookie(name, options);
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
