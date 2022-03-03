/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { UserDB } from '@gitpod/gitpod-db/lib';
import { GitpodTokenType } from '@gitpod/gitpod-protocol';
import * as crypto from 'crypto';
import * as express from 'express';
import { IncomingHttpHeaders } from 'http';
import { inject, injectable } from 'inversify';
import { AllAccessFunctionGuard, ExplicitFunctionAccessGuard, WithFunctionAccessGuard } from './function-access';
import { TokenResourceGuard, WithResourceAccessGuard } from './resource-access';

export function getBearerToken(headers: IncomingHttpHeaders): string | undefined {
    const authorizationHeader = headers['authorization'];
    if (!authorizationHeader || !(typeof authorizationHeader === 'string')) {
        return;
    }
    if (!authorizationHeader.startsWith('Bearer ')) {
        return;
    }

    const token = authorizationHeader.substring('Bearer '.length);
    const hash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
    return hash;
}

const bearerAuthCode = 'BearerAuth';
interface BearerAuthError extends Error {
    code: typeof bearerAuthCode;
}
export function isBearerAuthError(error: Error): error is BearerAuthError {
    return 'code' in error && (error as any)['code'] === bearerAuthCode;
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
                await this.auth(req);
            } catch (e) {
                if (isBearerAuthError(e)) {
                    res.status(401).send(e.message);
                    return;
                }
                return next(e);
            }
            return next();
        };
    }

    get restHandlerOptionally(): express.RequestHandler {
        return async (req, res, next) => {
            try {
                await this.auth(req);
            } catch (e) {
                // don't error the request, we just have not bearer authentication token
            }
            return next();
        };
    }

    async auth(req: express.Request): Promise<void> {
        const token = getBearerToken(req.headers);
        if (!token) {
            throw createBearerAuthError('missing Bearer token');
        }
        const userAndToken = await this.userDB.findUserByGitpodToken(token, GitpodTokenType.API_AUTH_TOKEN);
        if (!userAndToken) {
            throw createBearerAuthError('invalid Bearer token');
        }

        // hack: load the user again to get ahold of all identities
        // TODO(cw): instead of re-loading the user, we should properly join the identities in findUserByGitpodToken
        const user = (await this.userDB.findUserById(userAndToken.user.id))!;

        const resourceGuard = new TokenResourceGuard(userAndToken.user.id, userAndToken.token.scopes);
        (req as WithResourceAccessGuard).resourceGuard = resourceGuard;

        const functionScopes = userAndToken.token.scopes
            .filter((s) => s.startsWith('function:'))
            .map((s) => s.substring('function:'.length));
        if (functionScopes.length === 1 && functionScopes[0] === '*') {
            (req as WithFunctionAccessGuard).functionGuard = new AllAccessFunctionGuard();
        } else {
            // We always install a function access guard. If the token has no scopes, it's not allowed to do anything.
            (req as WithFunctionAccessGuard).functionGuard = new ExplicitFunctionAccessGuard(functionScopes);
        }

        req.user = user;
    }
}
