/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderInfo, GuessedGitTokenScopes, GuessGitTokenScopesParams } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { RepoURL } from "../repohost";
import { GitTokenValidator } from "./git-token-validator";

@injectable()
export class GitTokenScopeGuesser {
    @inject(GitTokenValidator) tokenValidator: GitTokenValidator;

    async guessGitTokenScopes(
        authProvider: AuthProviderInfo | undefined,
        params: GuessGitTokenScopesParams,
    ): Promise<GuessedGitTokenScopes> {
        if (!authProvider) {
            return { message: "Unknown host" };
        }
        const { repoUrl, gitCommand, currentToken } = params;

        const parsedRepoUrl = repoUrl && RepoURL.parseRepoUrl(repoUrl);
        if (!parsedRepoUrl) {
            return { message: `Unknown repository '${repoUrl}'` };
        }

        const { host, repo, owner, repoKind } = parsedRepoUrl;

        // in case of git operation which require write access to a remote
        if (gitCommand === "push") {
            const validationResult = await this.tokenValidator.checkWriteAccess({
                host,
                owner,
                repo,
                repoKind,
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
}
