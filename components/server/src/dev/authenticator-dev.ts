/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as express from 'express';
import { injectable, inject } from 'inversify';
import { UserDB } from '@gitpod/gitpod-db/lib';
import { Strategy as DummyStrategy } from 'passport-dummy';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { ResponseError } from 'vscode-jsonrpc';
import { Authenticator } from '../auth/authenticator';
import { AuthProvider } from '../auth/auth-provider';
import { AuthProviderInfo } from '@gitpod/gitpod-protocol';
import { DevData } from './dev-data';

@injectable()
export class AuthenticatorDevImpl extends Authenticator {
    @inject(UserDB) protected userDb: UserDB;

    protected async getAuthProviderForHost(_host: string): Promise<AuthProvider | undefined> {
        return new DummyAuthProvider(this.userDb);
    }
}

class DummyAuthProvider implements AuthProvider {
    constructor(protected userDb: UserDB) {}
    get info(): AuthProviderInfo {
        return {
            authProviderId: 'Public-GitHub',
            authProviderType: 'GitHub',
            verified: true,
            host: 'github.com',
            icon: this.params.icon,
            description: this.params.description,
        };
    }
    readonly host = 'github.com';
    readonly authProviderId = 'GitHub';
    readonly params = {} as any;
    readonly authCallbackPath = '';
    readonly callback = () => {
        throw new Error('Method not implemented.');
    };
    readonly strategy = new DummyStrategy(async (done) => {
        const maybeUser = await this.userDb.findUserById(DevData.createTestUser().id);
        if (!maybeUser) {
            done(new ResponseError(ErrorCodes.NOT_AUTHENTICATED, 'No dev user in DB.'), undefined);
        }
        try {
            done(undefined, maybeUser);
        } catch (err) {
            done(err, undefined);
        }
    });
    authenticate(req: express.Request, res: express.Response, next: express.NextFunction): void {
        throw new Error('Method not implemented.');
    }
    authorize(req: express.Request, res: express.Response, next: express.NextFunction, scopes: string[]): void {
        throw new Error('Method not implemented.');
    }
}
