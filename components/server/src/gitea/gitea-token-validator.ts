/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { CheckWriteAccessResult, IGitTokenValidator, IGitTokenValidatorParams } from "../workspace/git-token-validator";
import { GiteaApiError, GiteaRestApi, GiteaResult } from "./api";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

@injectable()
export class GiteaTokenValidator implements IGitTokenValidator {
	@inject(GiteaRestApi) githubRestApi: GiteaRestApi;

	async checkWriteAccess(params: IGitTokenValidatorParams): Promise<CheckWriteAccessResult> {

		const { token, repoFullName } = params;

		const parsedRepoName = this.parseGiteaRepoName(repoFullName);
		if (!parsedRepoName) {
			throw new Error(`Could not parse repo name: ${repoFullName}`);
		}
		let repo;
		try {
			repo = await this.githubRestApi.run(token, api => api.repos.get(parsedRepoName));
		} catch (error) {
			if (GiteaApiError.is(error) && error.response?.status === 404) {
				return { found: false };
			}
			log.error('Error getting repo information from Gitea', error, { repoFullName, parsedRepoName })
			return { found: false, error };
		}

		const mayWritePrivate = GiteaResult.mayWritePrivate(repo);
		const mayWritePublic = GiteaResult.mayWritePublic(repo);

		const isPrivateRepo = repo.data.private;
		let writeAccessToRepo = repo.data.permissions?.push;
		const inOrg = repo.data.owner?.type === "Organization";

		if (inOrg) {
			// if this repository belongs to an organization and Gitpod is not authorized,
			// we're not allowed to list repositories using this a token issues for
			// Gitpod's OAuth App.

			const request = {
				query: `
				query {
					organization(login: "${parsedRepoName.owner}") {
						repositories(first: 1) {
							totalCount
						}
					}
				}
				`.trim()
			};
			try {
				await this.githubGraphQLEndpoint.runQueryWithToken(token, request)
			} catch (error) {
				const errors = error.result?.errors;
				if (errors && errors[0] && (errors[0] as any)["type"] === "FORBIDDEN") {
					writeAccessToRepo = false;
				} else {
					log.error('Error getting organization information from Gitea', error, { org: parsedRepoName.owner })
					throw error;
				}
			}
		}
		return {
			found: true,
			isPrivateRepo,
			writeAccessToRepo,
			mayWritePrivate,
			mayWritePublic
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