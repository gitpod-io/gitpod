/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { UserDB } from '@gitpod/gitpod-db/lib/user-db';
import { GitpodTokenType } from '@gitpod/gitpod-protocol';
import * as crypto from 'crypto';
import * as express from 'express';
import { inject, injectable } from 'inversify';
import { Headers } from 'request';
import * as websocket from 'ws';
import { WsNextFunction, WsRequestHandler } from '../express/ws-handler';
import { AllAccessFunctionGuard, ExplicitFunctionAccessGuard, WithFunctionAccessGuard } from './function-access';
import { TokenResourceGuard, WithResourceAccessGuard } from './resource-access';

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

const bearerAuthCode = 'BearerAuth';
interface BearerAuthError extends Error {
    code: typeof bearerAuthCode
}
function isBearerAuthError(error: Error): error is BearerAuthError {
    return 'code' in error && error['code'] === bearerAuthCode;
}
function createBearerAuthError(message: string): BearerAuthError {
    return Object.assign(new Error(message), { code: bearerAuthCode } as { code: typeof bearerAuthCode });
}

@injectable()
export class BearerAuth {
    @inject(UserDB) protected readonly userDB: UserDB;

    get restHandler(): express.RequestHandler {
        return async (req, res, next) => {
            try {
                await this.doAuth(req);
            } catch (e) {
                if (isBearerAuthError(e)) {
                    res.status(401).send(e.message);
                    return;
                }
                throw e;
            }
            return next();
        }
    }

    public get websocketHandler(): WsRequestHandler {
        return async (ws: websocket, req: express.Request, next: WsNextFunction): Promise<void> => {
            await this.doAuth(req);
            return next();
        }
    }

    private async doAuth(req: express.Request): Promise<void> {
        const token = getBearerToken(req.headers)
        if (!token) {
            throw createBearerAuthError('missing Bearer token');
        }
        const userAndToken = await this.userDB.findUserByGitpodToken(token, GitpodTokenType.API_AUTH_TOKEN);
        if (!userAndToken) {
            throw createBearerAuthError("invalid Bearer token");
        }

        // hack: load the user again to get ahold of all identities
        // TODO(cw): instead of re-loading the user, we should properly join the identities in findUserByGitpodToken
        const user = (await this.userDB.findUserById(userAndToken.user.id))!;

        const resourceGuard = new TokenResourceGuard(userAndToken.user.id, userAndToken.token.scopes);
        (req as WithResourceAccessGuard).resourceGuard = resourceGuard;

        const functionScopes = userAndToken.token.scopes
            .filter(s => s.startsWith("function:"))
            .map(s => s.substring("function:".length));
        if (functionScopes.length === 1 && functionScopes[0] === "*") {
            (req as WithFunctionAccessGuard).functionGuard = new AllAccessFunctionGuard();
        } else {
            // We always install a function access guard. If the token has no scopes, it's not allowed to do anything.
            (req as WithFunctionAccessGuard).functionGuard = new ExplicitFunctionAccessGuard(functionScopes);
        }

        req.user = user;
    }

}
