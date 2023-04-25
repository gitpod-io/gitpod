/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { RepositoryService } from "../../../src/repohost/repo-service";
import { inject, injectable } from "inversify";
import { GitHubGraphQlEndpoint, GitHubRestApi } from "../../../src/github/api";
import { GitHubEnterpriseApp } from "./github-enterprise-app";
import { GithubContextParser } from "../../../src/github/github-context-parser";
import { ProviderRepository, User } from "@gitpod/gitpod-protocol";
import { Config } from "../../../src/config";
import { TokenService } from "../../../src/user/token-service";
import { HostContext } from "../../../src/auth/host-context";

@injectable()
export class GitHubService extends RepositoryService {
    static PREBUILD_TOKEN_SCOPE = "prebuilds";

    @inject(GitHubGraphQlEndpoint) protected readonly githubQueryApi: GitHubGraphQlEndpoint;
    @inject(GitHubRestApi) protected readonly githubApi: GitHubRestApi;
    @inject(Config) protected readonly config: Config;
    @inject(TokenService) protected tokenService: TokenService;
    @inject(GithubContextParser) protected githubContextParser: GithubContextParser;

    // TODO: consider refactoring this to either use GH Search API w/ typeahead search only OR
    // return results in a stream, appending pages as being fetched (via callback below) OR
    // simply use octokit.request w/ basic paginated api funcs (return # of pages + return a single page),
    // so the UI can remain interactive vs. currently frozen for 5-10+ mins until all pages are fetched.
    async getRepositoriesForAutomatedPrebuilds(hostContext: HostContext, user: User): Promise<ProviderRepository[]> {
        const host = hostContext.host;
        const octokit = await this.githubApi.create(user, host);
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

    async canInstallAutomatedPrebuilds(hostContext: HostContext, user: User, cloneUrl: string): Promise<boolean> {
        const { host, owner, repoName: repo } = await this.githubContextParser.parseURL(hostContext, user, cloneUrl);

        try {
            // You need "ADMIN" permission on a repository to be able to install a webhook.
            // Ref: https://docs.github.com/en/organizations/managing-access-to-your-organizations-repositories/repository-roles-for-an-organization#permissions-for-each-role
            // Ref: https://docs.github.com/en/graphql/reference/enums#repositorypermission
            const result: any = await this.githubQueryApi.runQuery(
                user,
                host,
                `
                query {
                    repository(name: "${repo}", owner: "${owner}") {
                        viewerPermission
                    }
                }
            `,
            );
            return result.data.repository && result.data.repository.viewerPermission === "ADMIN";
        } catch (err) {
            return false;
        }
    }

    async installAutomatedPrebuilds(hostContext: HostContext, user: User, cloneUrl: string): Promise<void> {
        const { owner, repoName: repo } = await this.githubContextParser.parseURL(hostContext, user, cloneUrl);
        const host = hostContext.host;
        const webhooks = (await this.githubApi.run(user, host, (gh) => gh.repos.listWebhooks({ owner, repo }))).data;
        for (const webhook of webhooks) {
            if (webhook.config.url === this.getHookUrl()) {
                await this.githubApi.run(user, host, (gh) =>
                    gh.repos.deleteWebhook({ owner, repo, hook_id: webhook.id }),
                );
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
        await this.githubApi.run(user, host, (gh) => gh.repos.createWebhook({ owner, repo, config }));
    }

    protected getHookUrl() {
        return this.config.hostUrl
            .with({
                pathname: GitHubEnterpriseApp.path,
            })
            .toString();
    }
}
