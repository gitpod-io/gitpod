/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ILogger } from "@theia/core";
import { inject, injectable } from "inversify";
import { ForkCreator } from "../../githoster/fork/fork-creator";
import { GitHubRestApi } from "../github-model/github-rest-api";
import { ForksLoader } from "../../githoster/fork/forks-loader";

@injectable()
export class GitHubForkCreator implements ForkCreator {

    @inject(GitHubRestApi) protected readonly restApi: GitHubRestApi;
    @inject(ILogger) protected readonly logger: ILogger;

    async createFork(repo: ForksLoader.Repo, organization?: string): Promise<string | undefined> {
        let fullNameOfFork: string | undefined;
        try {
            const response = await this.restApi.run<{ full_name: string }>(api => api.repos.createFork({
                organization,
                owner: repo.owner,
                repo: repo.name
            }));
            fullNameOfFork = response.data.full_name;
        } catch (error) {
            const e = !!error ? error : ForkCreator.GENERIC_CREATE_FORK_ERROR;
            this.logger.error(e);
            throw e;
        }
        return fullNameOfFork;
    }
}
