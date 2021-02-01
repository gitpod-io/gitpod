/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as express from 'express';
import { injectable, inject } from 'inversify';
import { Env } from '../env';

@injectable()
export class SelectAccountCookie {
    @inject(Env) protected readonly env: Env;

    set(res: express.Response, hints: object) {
        if (res.headersSent) {
            return;
        }
        res.cookie("SelectAccountCookie", JSON.stringify(hints), {
            httpOnly: false, // we need this hint on frontend
            domain: `${this.env.hostUrl.url.host}`,
            maxAge: 5 * 60 * 1000 /* ms */
        });
    }

    unset(res: express.Response) {
        if (res.headersSent) {
            return;
        }
        res.clearCookie('SelectAccountCookie', {
            path: "/",
            domain: `.${this.env.hostUrl.url.host}`
        });
    }
}