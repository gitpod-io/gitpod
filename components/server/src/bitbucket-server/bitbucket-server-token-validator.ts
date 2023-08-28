/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
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
        let writeAccessToRepo: boolean | undefined = false;

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

        if (!found) {
            return {
                found,
                isPrivateRepo,
                writeAccessToRepo,
            };
        }

        // We can't check REPO_WRITE permission on BitBucketServer since there's no open api for it if we don't change data
        // Leave this check back to BBS it self when push
        writeAccessToRepo = true;

        return {
            found,
            isPrivateRepo,
            writeAccessToRepo,
        };
    }
}
