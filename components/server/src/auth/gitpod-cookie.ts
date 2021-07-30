/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as express from 'express';
import { injectable, inject } from 'inversify';
import { Config } from '../config';

@injectable()
export class GitpodCookie {
    @inject(Config) protected readonly env: Config;
    /**
     * The cookie is used to distinguish between users and new website visitors.
     */
    setCookie(res: express.Response) {
        if (res.headersSent) {
            return;
        }
        res.cookie('gitpod-user', 'loggedIn', {
            path: "/",
            httpOnly: false,
            secure: false,
            maxAge: 1000 * 60 * 60 * 24 * 7,    // 7 days
            sameSite: "lax",                    // default: true. "Lax" needed for OAuth.
            domain: `.${this.env.hostUrl.url.host}`
        });
    }

    unsetCookie(res: express.Response) {
        if (res.headersSent) {
            return;
        }
        res.cookie('gitpod-user', '', {
            path: "/",
            domain: `.${this.env.hostUrl.url.host}`,
            maxAge: 0
        });
    }
}