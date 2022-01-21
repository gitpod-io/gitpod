/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AuthProviderInfo, GuessedGitTokenScopes, GuessGitTokenScopesParams } from '@gitpod/gitpod-protocol';
import { inject, injectable } from 'inversify';
import { GitTokenValidator } from './git-token-validator';

@injectable()
export class GitTokenScopeGuesser {
  @inject(GitTokenValidator) tokenValidator: GitTokenValidator;

  async guessGitTokenScopes(
    authProvider: AuthProviderInfo | undefined,
    params: GuessGitTokenScopesParams,
  ): Promise<GuessedGitTokenScopes> {
    if (!authProvider) {
      return { message: 'Unknown host' };
    }
    const { repoUrl, gitCommand, currentToken } = params;

    const repoFullName = repoUrl && this.parseRepoFull(repoUrl);
    if (!repoFullName) {
      return { message: `Unknown repository '${repoUrl}'` };
    }

    // in case of git operation which require write access to a remote
    if (gitCommand === 'push') {
      const validationResult = await this.tokenValidator.checkWriteAccess({
        host: authProvider.host,
        repoFullName,
        token: currentToken.token,
      });
      const hasWriteAccess = validationResult && validationResult.writeAccessToRepo === true;
      if (hasWriteAccess) {
        const isPublic = validationResult && !validationResult.isPrivateRepo;
        const requiredScopesForGitCommand = isPublic
          ? authProvider.requirements!.publicRepo
          : authProvider.requirements!.privateRepo;
        return { scopes: requiredScopesForGitCommand };
      } else {
        return { message: `The remote repository "${repoUrl}" is not accessible with the current token.` };
      }
    }
    return { scopes: authProvider.requirements!.default };
  }

  /**
   * @returns full name of the repo, e.g. group/subgroup1/subgroug2/project-repo
   *
   * @param repoUrl e.g. https://gitlab.domain.com/group/subgroup1/subgroug2/project-repo.git
   */
  protected parseRepoFull(repoUrl: string | undefined): string | undefined {
    if (repoUrl && repoUrl.startsWith('https://') && repoUrl.endsWith('.git')) {
      const parts = repoUrl.substr('https://'.length).split('/').splice(1); // without host parts
      if (parts.length >= 2) {
        parts[parts.length - 1] = parts[parts.length - 1].slice(0, -1 * '.git'.length);
        return parts.join('/');
      }
    }
    return undefined;
  }
}
