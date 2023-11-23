/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { RepositoryService } from "../repohost/repo-service";
import { inject, injectable } from "inversify";
import { GitHubGraphQlEndpoint, GitHubRestApi } from "../github/api";
import { GitHubEnterpriseApp } from "./github-enterprise-app";
import { GithubContextParser } from "../github/github-context-parser";
import { ProviderRepository, User } from "@gitpod/gitpod-protocol";
import { Config } from "../config";
import { TokenService } from "../user/token-service";

@injectable()
export class GitHubService extends RepositoryService {
    static PREBUILD_TOKEN_SCOPE = "prebuilds";

    constructor(
        @inject(GitHubGraphQlEndpoint) protected readonly githubQueryApi: GitHubGraphQlEndpoint,
        @inject(GitHubRestApi) protected readonly githubApi: GitHubRestApi,
        @inject(Config) private readonly config: Config,
        @inject(TokenService) private readonly tokenService: TokenService,
        @inject(GithubContextParser) private readonly githubContextParser: GithubContextParser,
    ) {
        super();
    }

    // TODO: consider refactoring this to either use GH Search API w/ typeahead search only OR
    // return results in a stream, appending pages as being fetched (via callback below) OR
    // simply use octokit.request w/ basic paginated api funcs (return # of pages + return a single page),
    // so the UI can remain interactive vs. currently frozen for 5-10+ mins until all pages are fetched.
    async getRepositoriesForAutomatedPrebuilds(user: User): Promise<ProviderRepository[]> {
        const octokit = await this.githubApi.create(user);
        const repositories = await octokit.paginate(
            octokit.repos.listForAuthenticatedUser,
            { per_page: 100 },
            (response) =>
                response.data
                    // On very large GH Enterprise (3.3.9) instances, items can be null
                    .filter((r) => !!r?.permissions?.admin)
                    .map((r) => {
                        return <ProviderRepository>{
                            name: r.name,
                            cloneUrl: r.clone_url,
                            account: r.owner.login,
                            accountAvatarUrl: r.owner.gravatar_id
                                ? `https://www.gravatar.com/avatar/${r.owner.gravatar_id}?size=128`
                                : r.owner.avatar_url,
                            updatedAt: r.updated_at,
                        };
                    }),
        );
        return repositories;
    }

    async installAutomatedPrebuilds(user: User, cloneUrl: string): Promise<void> {
        const { owner, repoName: repo } = await this.githubContextParser.parseURL(user, cloneUrl);
        const webhooks = (await this.githubApi.run(user, (gh) => gh.repos.listWebhooks({ owner, repo }))).data;
        for (const webhook of webhooks) {
            if (webhook.config.url === this.getHookUrl()) {
                await this.githubApi.run(user, (gh) => gh.repos.deleteWebhook({ owner, repo, hook_id: webhook.id }));
            }
        }
        const tokenEntry = await this.tokenService.createGitpodToken(
            user,
            GitHubService.PREBUILD_TOKEN_SCOPE,
            cloneUrl,
        );
        const config = {
            url: this.getHookUrl(),
            content_type: "json",
            secret: user.id + "|" + tokenEntry.token.value,
        };
        await this.githubApi.run(user, (gh) => gh.repos.createWebhook({ owner, repo, config }));
    }

    protected getHookUrl() {
        return this.config.hostUrl
            .asPublicServices()
            .with({
                pathname: GitHubEnterpriseApp.path,
            })
            .toString();
    }
}
