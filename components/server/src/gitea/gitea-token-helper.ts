/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { AuthProviderParams } from "../auth/auth-provider";
import { User, Token } from "@gitpod/gitpod-protocol";
import { UnauthorizedError } from "../errors";
import { GiteaScope } from "./scopes";
import { TokenProvider } from "../user/token-provider";

@injectable()
export class GiteaTokenHelper {
    @inject(AuthProviderParams) readonly config: AuthProviderParams;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;

    async getCurrentToken(user: User) {
        try {
            return await this.getTokenWithScopes(user, [/* any scopes */]);
        } catch {
            // no token
        }
    }

    async getTokenWithScopes(user: User, requiredScopes: string[]) {
        const { host } = this.config;
        try {
            const token = await this.tokenProvider.getTokenForHost(user, host);
            if (this.containsScopes(token, requiredScopes)) {
                return token;
            }
        } catch {
            // no token
        }
        if (requiredScopes.length === 0) {
            requiredScopes = GiteaScope.Requirements.DEFAULT
        }
        throw UnauthorizedError.create(host, requiredScopes, "missing-identity");
    }
    protected containsScopes(token: Token, wantedScopes: string[] | undefined): boolean {
        const wantedSet = new Set(wantedScopes);
        const currentScopes = [...token.scopes];
        if (currentScopes.some(s => s === GiteaScope.PRIVATE)) {
            currentScopes.push(GiteaScope.PUBLIC); // normalize private_repo, which includes public_repo
        }
        currentScopes.forEach(s => wantedSet.delete(s));
        return wantedSet.size === 0;
    }
}
