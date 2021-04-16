/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ILogger } from "@theia/core";
import { Gitlab } from "gitlab";
import { inject, injectable } from "inversify";
import { ForkCreator } from "../../githoster/fork/fork-creator";
import { GitpodGitTokenProvider } from "../../gitpod-git-token-provider";
import { GitLabExtension } from "../gitlab-extension";

@injectable()
export class GitLabForkCreator implements ForkCreator {

    @inject(ILogger) protected readonly logger: ILogger;

    @inject(GitLabExtension)
    protected readonly extension: GitLabExtension;

    @inject(GitpodGitTokenProvider)
    protected readonly tokenProvider: GitpodGitTokenProvider;

    async gitlabApi() {
        const { host } = this.extension;
        const token = await this.tokenProvider.getGitToken({ host });
        return new Gitlab({
            oauthToken: token.token,
            host: `https://${host}`
        });
    }

    async createFork(repo: { name: string, owner: string }, organization?: string): Promise<string | undefined> {
        if (!!organization) {
            // TODO
            this.logger.error("Forking to GitLab organization not supported yet.");
        }
        try {
            const api = await this.gitlabApi();
            const result = (await api.Projects.fork(`${repo.owner}/${repo.name}`)) as any;
            const fullNameOfFork = !!result.path_with_namespace ? result.path_with_namespace : undefined;
            const isFinished = async () => (await api.Projects.show(fullNameOfFork)).import_status == "finished";
            let isFinishedResult = await isFinished();
            if (!isFinishedResult) {
                // check 5 times if finished with 1 second pause each
                for (let i = 0; i < 5; i++) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    isFinishedResult = await isFinished();
                    this.logger.info("Check if finished %s: %s", i, isFinishedResult);
                    if (isFinishedResult) {
                        break;
                    }
                }
            }
            return fullNameOfFork;
        } catch (error) {
            const e = !!error ? error : ForkCreator.GENERIC_CREATE_FORK_ERROR;
            this.logger.error(e);
            throw e;
        }
    }
}
