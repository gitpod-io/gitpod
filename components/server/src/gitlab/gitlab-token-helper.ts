/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User, Token } from '@gitpod/gitpod-protocol';
import { UnauthorizedError } from '../errors';
import { AuthProviderParams } from '../auth/auth-provider';
import { injectable, inject } from 'inversify';
import { GitLabScope } from './scopes';
import { TokenProvider } from '../user/token-provider';

@injectable()
export class GitLabTokenHelper {
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
      if (this.containsScopes(token, requiredScopes)) {
        return token;
      }
    } catch {
      // no token
    }
    if (requiredScopes.length === 0) {
      requiredScopes = GitLabScope.Requirements.DEFAULT;
    }
    throw UnauthorizedError.create(host, requiredScopes, 'missing-identity');
  }
  protected containsScopes(token: Token, wantedScopes: string[] | undefined): boolean {
    const set = new Set(wantedScopes);
    token.scopes.forEach((s) => set.delete(s));
    return set.size === 0;
  }
}
