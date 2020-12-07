/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import * as express from 'express';
import { AuthProviderInfo, User, OAuth2Config, AuthProviderEntry } from "@gitpod/gitpod-protocol";
import { saveSession } from '../express-util';

import { UserEnvVarValue } from "@gitpod/gitpod-protocol";

export const AuthProviderParams = Symbol("AuthProviderParams");
export interface AuthProviderParams extends AuthProviderEntry {
    readonly builtin: boolean; // true, if `ownerId` == ""
    readonly verified: boolean; // true, if `status` == "verified"

    readonly oauth: OAuth2Config & {
        // extending:
        readonly configFn?: string;
    }

    // for special auth providers only
    readonly params?: {
        [key: string]: string;
        readonly authUrl: string;
        readonly callBackUrl: string;
        readonly githubToken: string;
    }

    // properties to control behavior
    readonly hiddenOnDashboard?: boolean;
    readonly loginContextMatcher?: string;
    readonly disallowLogin?: boolean;
    readonly requireTOS?: boolean;

    readonly description: string;
    readonly icon: string;
}
export function parseAuthProviderParamsFromEnv(json: object): AuthProviderParams[] {
    const result: AuthProviderParams[] = [];
    if (Array.isArray(json)) {
        for (const o of json) {
            result.push({
                ...o,
                ownerId: "",
                builtin: true,
                status: "verified",
                verified: true,
            })
        }
    }
    return result;
}

export interface AuthUserSetup {
    authUser: AuthUser;
    blockUser?: boolean;
    currentScopes: string[];
    envVars?: UserEnvVarValue[];
}

export interface AuthUser {
    readonly authId: string;
    readonly authName: string;
    readonly primaryEmail: string;
    readonly name?: string;
    readonly avatarUrl?: string;
}

export const AuthProvider = Symbol('AuthProvider');
export interface AuthProvider {
    readonly authProviderId: string;
    readonly config: AuthProviderParams;
    readonly info: AuthProviderInfo;
    readonly authCallbackPath: string;
    readonly callback: express.RequestHandler;
    authorize(req: express.Request, res: express.Response, next: express.NextFunction, scopes?: string[]): void;
    refreshToken?(user: User): Promise<void>;
}

export interface AuthFlow {
    readonly host: string;
    readonly returnTo: string;
    readonly returnToAfterTos?: string;
}
export namespace AuthFlow {
    export function get(session: Express.Session | undefined): AuthFlow | undefined {
        if (session) {
            return session['authBag'] as AuthFlow | undefined;
        }
    }
    export async function attach(session: Express.Session, authBag: AuthFlow): Promise<void> {
        session['authBag'] = authBag;
        return saveSession(session);
    }
    export async function clear(session: Express.Session | undefined) {
        if (session) {
            session['authBag'] = undefined;
            return saveSession(session);
        }
    }
}
