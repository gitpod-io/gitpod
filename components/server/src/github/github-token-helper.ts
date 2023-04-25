/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { User, Token } from "@gitpod/gitpod-protocol";
import { UnauthorizedError } from "../errors";
import { GitHubScope } from "./scopes";
import { TokenProvider } from "../user/token-provider";

@injectable()
export class GitHubTokenHelper {
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;

    async getCurrentToken(user: User, host: string) {
        try {
            return await this.getTokenWithScopes(user, host, [
                /* any scopes */
            ]);
        } catch {
            // no token
        }
    }

    async getTokenWithScopes(user: User, host: string, requiredScopes: string[]) {
        try {
            const token = await this.tokenProvider.getTokenForHost(user, host);
            if (this.containsScopes(token, requiredScopes)) {
                return token;
            }
        } catch {
            // no token
        }
        if (requiredScopes.length === 0) {
            requiredScopes = GitHubScope.Requirements.DEFAULT;
        }
        throw UnauthorizedError.create(host, requiredScopes, "missing-identity");
    }
    protected containsScopes(token: Token, wantedScopes: string[] | undefined): boolean {
        const wantedSet = new Set(wantedScopes);
        const currentScopes = [...token.scopes];
        if (currentScopes.some((s) => s === GitHubScope.PRIVATE)) {
            currentScopes.push(GitHubScope.PUBLIC); // normalize private_repo, which includes public_repo
        }
        currentScopes.forEach((s) => wantedSet.delete(s));
        return wantedSet.size === 0;
    }
}
