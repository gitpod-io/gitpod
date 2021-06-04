/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as express from 'express';
import * as session from 'express-session'
import { SessionOptions } from 'express-session'
import * as uuidv4 from "uuid/v4"
import { injectable, inject , postConstruct } from 'inversify';
import * as signature from 'cookie-signature';
import * as cookie from 'cookie';

import * as MySQLStore from 'express-mysql-session';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { Config as DBConfig } from '@gitpod/gitpod-db/lib/config';
import { Config } from './config';


@injectable()
export class SessionHandlerProvider {
    @inject(Config) protected readonly config: Config;
    @inject(DBConfig) protected readonly dbConfig: DBConfig;

    public sessionHandler: express.RequestHandler

    @postConstruct()
    public init() {
        const options: SessionOptions = {} as SessionOptions
        options.cookie = this.getCookieOptions(this.config);
        options.genid = function (req: any) {
            return uuidv4() // use UUIDs for session IDs
        },
        options.name = SessionHandlerProvider.getCookieName(this.config);
        // options.proxy = true    // TODO SSL Proxy
        options.resave = true   // TODO Check with store! See docu
        options.rolling = true // default, new cookie and maxAge
        options.secret = this.config.session.secret;
        options.saveUninitialized = false   // Do not save new cookie without content (uninitialized)

        options.store = this.createStore();

        this.sessionHandler = session(options);
    }

    protected getCookieOptions(config: Config): express.CookieOptions {
        const hostName = config.hostUrl.url.host;

        let domain = hostName;
        if (config.devBranch) {
            // Use cookie for base domain to allow cookies being sent via ingress proxy in preview environments
            //
            // Otherwise, clients (in this case Chrome) may ignore (as in: save it, but don't send it on consequent requests) the 'Set-Cookie:...' send with a redirect (302, to github oauth)
            // For details, see:
            // - RFC draft sameSite: http://httpwg.org/http-extensions/draft-ietf-httpbis-cookie-same-site.html
            // - https://bugs.chromium.org/p/chromium/issues/detail?id=150066
            // - google: chromium not sending cookies set with redirect

            const hostParts = hostName.split('.');
            const baseDomain = hostParts.slice(hostParts.length - 2).join('.');
            domain = `.${baseDomain}`;
        }
        if (this.config.insecureNoDomain) {
            domain = hostName.split(":")[0];
        }

        return {
            path: "/",                    // default
            httpOnly: true,               // default
            secure: false,                // default, TODO SSL! Config proxy
            maxAge: config.session.maxAgeMs,  // configured in Helm chart, defaults to 3 days.
            sameSite: "lax",              // default: true. "Lax" needed for OAuth.
            domain: `${domain}`
        };
    }

    static getCookieName(config: Config) {
        return config.hostUrl.toString()
            .replace(/https?/, '')
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

    static generateCookieForSession(config: Config, session: Express.Session) {
        // This replicates the behavior of https://github.com/expressjs/session/blob/85682a2a56c5bdbed8d7e7cd2cc5e1343c951af6/index.js#L644
        const name = SessionHandlerProvider.getCookieName(config);
        const secret = config.session.secret;
        const signed = encodeURIComponent('s:' + signature.sign(session.id, secret));
        const cookieOptions = (session.cookie as any).data;
        return {
            cookie: {
                name,
                value: signed,
                ...cookieOptions
            },
            serialized: cookie.serialize(name, signed, cookieOptions)
        };
    }

    protected createStore(): any | undefined {
        const options = {
            ...(this.dbConfig.dbConfig as any),
            user: this.dbConfig.dbConfig.username,
            database: 'gitpod-sessions',
            createDatabaseTable: true
        };
        return new MySQLStore(options, undefined, (err) => {
            if (err) {
                log.debug('MySQL session store error: ', err);
            }
        });
    }
}