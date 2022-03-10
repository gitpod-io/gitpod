/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { RepositoryService } from "../../../src/repohost/repo-service";
import { inject, injectable } from "inversify";
import { GitHubGraphQlEndpoint, GitHubRestApi } from "../../../src/github/api";
import { GitHubEnterpriseApp } from "./github-enterprise-app";
import { AuthProviderParams } from "../../../src/auth/auth-provider";
import { GithubContextParser } from "../../../src/github/github-context-parser";
import { ProviderRepository, User } from "@gitpod/gitpod-protocol";
import { Config } from "../../../src/config";
import { TokenService } from "../../../src/user/token-service";

@injectable()
export class GitHubService extends RepositoryService {

    static PREBUILD_TOKEN_SCOPE = 'prebuilds';

    @inject(GitHubGraphQlEndpoint) protected readonly githubQueryApi: GitHubGraphQlEndpoint;
    @inject(GitHubRestApi) protected readonly githubApi: GitHubRestApi;
    @inject(Config) protected readonly config: Config;
    @inject(AuthProviderParams) protected authProviderConfig: AuthProviderParams;
    @inject(TokenService) protected tokenService: TokenService;
    @inject(GithubContextParser) protected githubContextParser: GithubContextParser;

    async getRepositoriesForAutomatedPrebuilds(user: User): Promise<ProviderRepository[]> {
        const repositories = (await this.githubApi.run(user, gh => gh.repos.listForAuthenticatedUser({}))).data;
        const adminRepositories = repositories.filter(r => !!r.permissions?.admin)
        return adminRepositories.map(r => {
            return <ProviderRepository>{
                name: r.name,
                cloneUrl: r.clone_url,
                account: r.owner?.login,
                accountAvatarUrl: r.owner?.avatar_url,
                updatedAt: r.updated_at
            };
        });
    }

    async canInstallAutomatedPrebuilds(user: User, cloneUrl: string): Promise<boolean> {
        const { host, owner, repoName: repo } = await this.githubContextParser.parseURL(user, cloneUrl);
        if (host !== this.authProviderConfig.host) {
            return false;
        }
        try {
            // You need "ADMIN" permission on a repository to be able to install a webhook.
            // Ref: https://docs.github.com/en/organizations/managing-access-to-your-organizations-repositories/repository-roles-for-an-organization#permissions-for-each-role
            // Ref: https://docs.github.com/en/graphql/reference/enums#repositorypermission
            const result: any = await this.githubQueryApi.runQuery(user, `
                query {
                    repository(name: "${repo}", owner: "${owner}") {
                        viewerPermission
                    }
                }
            `);
            return result.data.repository && result.data.repository.viewerPermission === 'ADMIN';
        } catch (err) {
            return false;
        }
    }

    async installAutomatedPrebuilds(user: User, cloneUrl: string): Promise<void> {
        const { owner, repoName: repo } = await this.githubContextParser.parseURL(user, cloneUrl);
        const webhooks = (await this.githubApi.run(user, gh => gh.repos.listWebhooks({ owner, repo }))).data;
        for (const webhook of webhooks) {
            if (webhook.config.url === this.getHookUrl()) {
                await this.githubApi.run(user, gh => gh.repos.deleteWebhook({ owner, repo, hook_id: webhook.id }));
            }
        }
        const tokenEntry = await this.tokenService.createGitpodToken(user, GitHubService.PREBUILD_TOKEN_SCOPE, cloneUrl);
        const config = {
            url: this.getHookUrl(),
            content_type: 'json',
            secret: user.id + '|' + tokenEntry.token.value,
        };
        await this.githubApi.run(user, gh => gh.repos.createWebhook({ owner, repo, config }));
    }

    protected getHookUrl() {
        return this.config.hostUrl.with({
            pathname: GitHubEnterpriseApp.path
        }).toString();
    }
}