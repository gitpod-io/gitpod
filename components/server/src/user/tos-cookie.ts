/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as express from 'express';
import { injectable, inject } from 'inversify';
import { Env } from '../env';

@injectable()
export class TosCookie {
    @inject(Env) protected readonly env: Env;

    set(res: express.Response, tosHints: object) {
        if (res.headersSent) {
            return;
        }
        res.cookie("tosHints", JSON.stringify(tosHints), {
            httpOnly: false, // we need this hin on frontend
            domain: `${this.env.hostUrl.url.host}`
        });
    }

    unset(res: express.Response) {
        if (res.headersSent) {
            return;
        }
        res.clearCookie('tosHints', {
            path: "/",
            domain: `.${this.env.hostUrl.url.host}`
        });
    }
}