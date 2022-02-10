/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { CheckWriteAccessResult, IGitTokenValidator, IGitTokenValidatorParams } from "../workspace/git-token-validator";
import { Gitea, GiteaRestApi } from "./api";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

@injectable()
export class GiteaTokenValidator implements IGitTokenValidator {
	@inject(GiteaRestApi) giteaApi: GiteaRestApi;

	async checkWriteAccess(params: IGitTokenValidatorParams): Promise<CheckWriteAccessResult> {

		const { token, repoFullName } = params;

		const parsedRepoName = this.parseGiteaRepoName(repoFullName);
		if (!parsedRepoName) {
			throw new Error(`Could not parse repo name: ${repoFullName}`);
		}
		const repo = await this.giteaApi.run<Gitea.Repository>(token, api => api.repos.repoGet(parsedRepoName.owner, parsedRepoName.repo));
		if (Gitea.ApiError.is(repo) && Gitea.ApiError.isNotFound(repo)) {
			return { found: false };
		} else if (Gitea.ApiError.is(repo)) {
			log.error('Error getting repo information from Gitea', repo, { repoFullName, parsedRepoName })
			return { found: false, error: repo };
		}

		const isPrivateRepo = repo.private;
		let writeAccessToRepo = repo.permissions?.push;

		return {
			found: true,
			isPrivateRepo,
			writeAccessToRepo,
			mayWritePrivate: true,
			mayWritePublic: true
		}
	}

	protected parseGiteaRepoName(repoFullName: string) {
		const parts = repoFullName.split("/");
		if (parts.length === 2) {
			return {
				owner: parts[0],
				repo: parts[1]
			}
		}
	}
}