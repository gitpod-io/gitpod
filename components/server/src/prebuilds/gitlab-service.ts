/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { RepositoryService } from "../repohost/repo-service";
import { User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { GitLabApi, GitLab } from "../gitlab/api";
import { GitLabApp } from "./gitlab-app";
import { Config } from "../config";
import { GitlabContextParser } from "../gitlab/gitlab-context-parser";
import { RepoURL } from "../repohost";
import { UnauthorizedError } from "../errors";
import { GitLabOAuthScopes } from "@gitpod/public-api-common/lib/auth-providers";

@injectable()
export class GitlabService extends RepositoryService {
    constructor(
        @inject(GitLabApi) protected api: GitLabApi,
        @inject(Config) private readonly config: Config,
        @inject(GitlabContextParser) private readonly gitlabContextParser: GitlabContextParser,
    ) {
        super();
    }

    public async isGitpodWebhookEnabled(user: User, cloneUrl: string): Promise<boolean> {
        try {
            const { owner, repoName } = await this.gitlabContextParser.parseURL(user, cloneUrl);
            const hooks = (await this.api.run(user, (g) =>
                g.ProjectHooks.all(`${owner}/${repoName}`),
            )) as unknown as GitLab.ProjectHook[];
            return hooks.some((hook) => hook.url === this.getHookUrl());
        } catch (error) {
            if (GitLab.ApiError.is(error)) {
                throw UnauthorizedError.create({
                    host: RepoURL.parseRepoUrl(cloneUrl)!.host,
                    providerType: "GitLab",
                    repoName: RepoURL.parseRepoUrl(cloneUrl)!.repo,
                    requiredScopes: GitLabOAuthScopes.Requirements.REPO,
                    providerIsConnected: true,
                });
            }
            throw error;
        }
    }

    private getHookUrl() {
        return this.config.hostUrl
            .asPublicServices()
            .with({
                pathname: GitLabApp.path,
            })
            .toString();
    }
}
