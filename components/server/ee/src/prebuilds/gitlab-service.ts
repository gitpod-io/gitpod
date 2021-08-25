/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { RepositoryService } from "../../../src/repohost/repo-service";
import { CommitContext, User, WorkspaceContext } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { GitLabApi, GitLab } from "../../../src/gitlab/api";
import { AuthProviderParams } from "../../../src/auth/auth-provider";
import { GitLabApp } from "./gitlab-app";
import { Env } from "../../../src/env";
import { TokenService } from "../../../src/user/token-service";
import { GitlabContextParser } from "../../../src/gitlab/gitlab-context-parser";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

@injectable()
export class GitlabService extends RepositoryService {

    static PREBUILD_TOKEN_SCOPE = 'prebuilds';

    @inject(GitLabApi) protected api: GitLabApi;
    @inject(Env) protected env: Env;
    @inject(AuthProviderParams) protected config: AuthProviderParams;
	@inject(TokenService) protected tokenService: TokenService;
	@inject(GitlabContextParser) protected gitlabContextParser: GitlabContextParser;

    async canInstallAutomatedPrebuilds(user: User, cloneUrl: string): Promise<boolean> {
        const { host, owner, repoName } = await this.gitlabContextParser.parseURL(user, cloneUrl);
        if (host !== this.config.host) {
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
                log.info('Deleting existing hook');
                existingProps = hook
                await api.ProjectHooks.remove(gitlabProjectId, hook.id);
            }
        }
        const tokenEntry = await this.tokenService.createGitpodToken(user, GitlabService.PREBUILD_TOKEN_SCOPE, cloneUrl);
        await api.ProjectHooks.add(gitlabProjectId, this.getHookUrl(), <Partial<GitLab.ProjectHook>>{
            ...existingProps,
            push_events: true,
            token: user.id+'|'+tokenEntry.token.value
        });
        log.info('Installed Webhook for ' + cloneUrl, { cloneUrl, userId: user.id });
    }

    async canAccessHeadlessLogs(user: User, context: WorkspaceContext): Promise<boolean> {
        if (!CommitContext.is(context)) {
            return false;
        }
        const { owner, name: repoName } = context.repository;

        try {
            // If we can "see" a project we are allowed to access it's headless logs
            const api = await this.api.create(user);
            const response = await api.Projects.show(`${owner}/${repoName}`);
            if (GitLab.ApiError.is(response)) {
                return false;
            }
            return true;
        } catch (err) {
            return false;
        }
    }

    protected getHookUrl() {
        return this.env.hostUrl.with({
            pathname: GitLabApp.path
        }).toString();
    }

}