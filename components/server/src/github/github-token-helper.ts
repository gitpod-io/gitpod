/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { AuthProviderParams } from "../auth/auth-provider";
import { User, Token } from "@gitpod/gitpod-protocol";
import { UnauthorizedError } from "../errors";
import { TokenProvider } from "../user/token-provider";
import { GitHubOAuthScopes } from "@gitpod/public-api-common/lib/auth-providers";

@injectable()
export class GitHubTokenHelper {
    @inject(AuthProviderParams) readonly config: AuthProviderParams;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;

    async getCurrentToken(user: User) {
        try {
            return await this.getTokenWithScopes(user, [
                /* any scopes */
            ]);
        } catch {
            // no token
        }
    }

    async getTokenWithScopes(user: User, requiredScopes: string[]) {
        const { host } = this.config;
        try {
            const token = await this.tokenProvider.getTokenForHost(user, host);
            if (token && this.containsScopes(token, requiredScopes)) {
                return token;
            }
        } catch {
            // no token
        }
        if (requiredScopes.length === 0) {
            requiredScopes = GitHubOAuthScopes.Requirements.DEFAULT;
        }
        throw UnauthorizedError.create({
            host,
            providerType: "GitHub",
            requiredScopes: GitHubOAuthScopes.Requirements.DEFAULT,
            providerIsConnected: false,
            isMissingScopes: true,
        });
    }
    protected containsScopes(token: Token, wantedScopes: string[] | undefined): boolean {
        const wantedSet = new Set(wantedScopes);
        const currentScopes = [...token.scopes];
        if (currentScopes.some((s) => s === GitHubOAuthScopes.PRIVATE)) {
            currentScopes.push(GitHubOAuthScopes.PUBLIC); // normalize private_repo, which includes public_repo
        }
        currentScopes.forEach((s) => wantedSet.delete(s));
        return wantedSet.size === 0;
    }
}
