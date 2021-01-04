/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as websocket from 'ws';
import * as express from 'express';
import * as crypto from 'crypto';
import { Headers } from 'request';
import { WsRequestHandler, WsNextFunction } from '../express/ws-handler';
import { GitpodTokenType } from '@gitpod/gitpod-protocol';
import { injectable, inject } from 'inversify';
import { UserDB } from '@gitpod/gitpod-db/lib/user-db';
import { WithResourceAccessGuard, TokenResourceGuard } from './resource-access';
import { WithFunctionAccessGuard, ExplicitFunctionAccessGuard } from './function-access';

export function getBearerToken(headers: Headers): string | undefined {
    const authorizationHeader = headers["authorization"];
    if (!authorizationHeader || !(typeof authorizationHeader === "string")) {
        return;
    }
    if (!authorizationHeader.startsWith("Bearer ")) {
        return;
    }

    const token = authorizationHeader.substring("Bearer ".length);
    const hash = crypto.createHash('sha256').update(token, 'utf8').digest("hex");
    return hash;
}

@injectable()
export class BearerAuth {
    @inject(UserDB) protected readonly userDB: UserDB;

    public get websocketHandler(): WsRequestHandler {
        return async (ws: websocket, req: express.Request, next: WsNextFunction): Promise<void> => {
            const token = getBearerToken(req.headers)
            if (!token) {
                throw new Error("not authenticated");
            }

            const userAndToken = await this.userDB.findUserByGitpodToken(token, GitpodTokenType.API_AUTH_TOKEN);
            if (!userAndToken) {
                throw new Error("invalid Bearer token");
            }

            const resourceGuard = new TokenResourceGuard(userAndToken.user.id, userAndToken.token.scopes);
            (req as WithResourceAccessGuard).resourceGuard = resourceGuard;

            const functionScopes = userAndToken.token.scopes
                .filter(s => s.startsWith("function:"))
                .map(s => s.substring("function:".length));
            // We always install a function access guard. If the token has no scopes, it's not allowed to do anything.
            (req as WithFunctionAccessGuard).functionGuard = new ExplicitFunctionAccessGuard(functionScopes);

            req.user = userAndToken.user;

            return next();
        }
    }

}
