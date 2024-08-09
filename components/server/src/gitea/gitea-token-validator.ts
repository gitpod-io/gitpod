/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { CheckWriteAccessResult, IGitTokenValidator, IGitTokenValidatorParams } from "../workspace/git-token-validator";
import { Gitea, GiteaRestApi } from "./api";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class GiteaTokenValidator implements IGitTokenValidator {
    @inject(GiteaRestApi) giteaApi: GiteaRestApi;

    async checkWriteAccess(params: IGitTokenValidatorParams): Promise<CheckWriteAccessResult> {
        const { token, owner, repo: repoName } = params;

        const repo = await this.giteaApi.run<Gitea.Repository>(token, (api) => api.repos.repoGet(owner, repoName));
        if (Gitea.ApiError.is(repo) && Gitea.ApiError.isNotFound(repo)) {
            return { found: false };
        } else if (Gitea.ApiError.is(repo)) {
            log.error("Error getting repo information from Gitea", repo, { repo, owner });
            return { found: false, error: repo };
        }

        const isPrivateRepo = repo.private;
        let writeAccessToRepo = repo.permissions?.push;

        return {
            found: true,
            isPrivateRepo,
            writeAccessToRepo,
            mayWritePrivate: true,
            mayWritePublic: true,
        };
    }
}
