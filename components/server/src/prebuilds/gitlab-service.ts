/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { RepositoryService } from "../repohost/repo-service";
import { User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { GitLabApi, GitLab } from "../gitlab/api";
import { AuthProviderParams } from "../auth/auth-provider";
import { GitLabApp } from "./gitlab-app";
import { Config } from "../config";
import { TokenService } from "../user/token-service";
import { GitlabContextParser } from "../gitlab/gitlab-context-parser";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class GitlabService extends RepositoryService {
    static PREBUILD_TOKEN_SCOPE = "prebuilds";

    @inject(GitLabApi) protected api: GitLabApi;
    @inject(Config) protected readonly config: Config;
    @inject(AuthProviderParams) protected authProviderConfig: AuthProviderParams;
    @inject(TokenService) protected tokenService: TokenService;
    @inject(GitlabContextParser) protected gitlabContextParser: GitlabContextParser;

    async canInstallAutomatedPrebuilds(user: User, cloneUrl: string): Promise<boolean> {
        const { host, owner, repoName } = await this.gitlabContextParser.parseURL(user, cloneUrl);
        if (host !== this.authProviderConfig.host) {
            return false;
        }
        const api = await this.api.create(user);
        const response = (await api.Projects.show(`${owner}/${repoName}`)) as unknown as GitLab.Project;
        if (GitLab.ApiError.is(response)) {
            throw response;
        }
        // one need to have at least the access level of a maintainer (40) in order to install webhooks on a project
        // cf. https://docs.gitlab.com/ee/api/members.html#valid-access-levels
        return GitLab.Permissions.hasMaintainerAccess(response);
    }

    async installAutomatedPrebuilds(user: User, cloneUrl: string): Promise<void> {
        const api = await this.api.create(user);
        const { owner, repoName } = await this.gitlabContextParser.parseURL(user, cloneUrl);
        const gitlabProjectId = `${owner}/${repoName}`;
        const hooks = (await api.ProjectHooks.all(gitlabProjectId)) as unknown as GitLab.ProjectHook[];
        if (GitLab.ApiError.is(hooks)) {
            throw hooks;
        }
        let existingProps: any = {};
        for (const hook of hooks) {
            if (hook.url === this.getHookUrl()) {
                log.info("Deleting existing hook");
                existingProps = hook;
                await api.ProjectHooks.remove(gitlabProjectId, hook.id);
            }
        }
        const tokenEntry = await this.tokenService.createGitpodToken(
            user,
            GitlabService.PREBUILD_TOKEN_SCOPE,
            cloneUrl,
        );
        await api.ProjectHooks.add(gitlabProjectId, this.getHookUrl(), <Partial<GitLab.ProjectHook>>{
            ...existingProps,
            push_events: true,
            token: user.id + "|" + tokenEntry.token.value,
        });
        log.info("Installed Webhook for " + cloneUrl, { cloneUrl, userId: user.id });
    }

    protected getHookUrl() {
        return this.config.hostUrl
            .asPublicServices()
            .with({
                pathname: GitLabApp.path,
            })
            .toString();
    }
}
