/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { CheckWriteAccessResult, IGitTokenValidator, IGitTokenValidatorParams } from "../workspace/git-token-validator";
import { BitbucketServerApi } from "./bitbucket-server-api";

@injectable()
export class BitbucketServerTokenValidator implements IGitTokenValidator {
    @inject(BitbucketServerApi) protected readonly api: BitbucketServerApi;

    async checkWriteAccess(params: IGitTokenValidatorParams): Promise<CheckWriteAccessResult> {
        const { token, owner, repo, repoKind } = params;
        if (!repoKind || !["users", "projects"].includes(repoKind)) {
            throw new Error("repo kind is missing");
        }

        let found = false;
        let isPrivateRepo: boolean | undefined;
        let writeAccessToRepo: boolean | undefined;

        try {
            const repository = await this.api.getRepository(token, {
                repoKind: repoKind as any,
                owner,
                repositorySlug: repo,
            });
            found = true;
            isPrivateRepo = !repository.public;
        } catch (error) {
            console.error(error);
        }

        if (found) {
            writeAccessToRepo = false;
            const username = await this.api.currentUsername(token);
            const userProfile = await this.api.getUserProfile(token, username);
            if (owner === userProfile.slug) {
                writeAccessToRepo = true;
            } else {
                let permission = await this.api.getPermission(token, {
                    repoKind: repoKind as any,
                    owner,
                    username,
                    repoName: repo,
                });
                if (permission && ["REPO_WRITE", "REPO_ADMIN", "PROJECT_ADMIN", ""].includes(permission)) {
                    writeAccessToRepo = true;
                }
            }
        }

        return {
            found,
            isPrivateRepo,
            writeAccessToRepo,
        };
    }
}
