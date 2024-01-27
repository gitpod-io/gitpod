/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import express from "express";
import { AuthProviderInfo, User, AuthProviderEntry } from "@gitpod/gitpod-protocol";

import { UserEnvVarValue } from "@gitpod/gitpod-protocol";

export const AuthProviderParams = Symbol("AuthProviderParams");
export interface AuthProviderParams extends AuthProviderEntry {
    /**
     * computed value: `true`, if `ownerId` == ""
     */
    readonly builtin: boolean;
    /**
     * computed value: `true`, if `status` == "verified"
     */
    readonly verified: boolean;

    readonly hiddenOnDashboard?: boolean;

    /**
     * @deprecated unused
     */
    readonly disallowLogin?: boolean;

    /**
     * @deprecated unused
     */
    readonly description: string;
    /**
     * @deprecated unused
     */
    readonly icon: string;
}
export function parseAuthProviderParamsFromEnv(json: object): AuthProviderParams[] {
    if (Array.isArray(json)) {
        return normalizeAuthProviderParams(json as AuthProviderParams[]);
    }
    return [];
}
export function normalizeAuthProviderParams(
    params: Omit<AuthProviderParams, "ownerId" | "builtin" | "status" | "verified">[],
): AuthProviderParams[] {
    const result: AuthProviderParams[] = [];
    for (const p of params) {
        result.push({
            ...p,
            ownerId: "",
            builtin: true,
            status: "verified",
            verified: true,
        });
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
    readonly company?: string;
    readonly created_at?: string;
}

export const AuthProvider = Symbol("AuthProvider");
export interface AuthProvider {
    readonly authProviderId: string;
    readonly params: AuthProviderParams;
    readonly info: AuthProviderInfo;
    readonly authCallbackPath: string;
    callback(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void>;
    authorize(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
        state: string,
        scopes?: string[],
    ): void;
    refreshToken?(user: User): Promise<void>;
}

export interface AuthFlow {
    readonly host: string;
    readonly returnTo: string;
    readonly overrideScopes?: boolean;
}
export namespace AuthFlow {
    export function is(obj: any): obj is AuthFlow {
        if (obj === undefined) {
            return false;
        }
        if (typeof obj !== "object") {
            return false;
        }

        if (!("host" in obj) || !("returnTo" in obj)) {
            return false;
        }

        return true;
    }
}
