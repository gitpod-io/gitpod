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

@injectable()
export class GitlabService extends RepositoryService {

    static PREBUILD_TOKEN_SCOPE = 'prebuilds';

    @inject(GitLabApi) protected api: GitLabApi;
    @inject(Env) protected env: Env;
    @inject(AuthProviderParams) protected config: AuthProviderParams;
	@inject(TokenService) protected tokenService: TokenService;
	@inject(GitlabContextParser) protected gitlabContextParser: GitlabContextParser;

    async canInstallAutomatedPrebuilds(user: User, cloneUrl: string): Promise<boolean> {
        const { host } = await this.gitlabContextParser.parseURL(user, cloneUrl);
        return host === this.config.host;
    }

    async installAutomatedPrebuilds(user: User, cloneUrl: string): Promise<void> {
        const api = await this.api.create(user);
        const { owner, repoName } = await this.gitlabContextParser.parseURL(user, cloneUrl);
        const response = (await api.Projects.show(`${owner}/${repoName}`)) as unknown as GitLab.Project;
        if (GitLab.ApiError.is(response)) {
            throw response;
        }
        const hooks = (await api.ProjectHooks.all(response.id)) as unknown as GitLab.ProjectHook[];
        if (GitLab.ApiError.is(hooks)) {
            throw hooks;
        }
        let existingProps: any = {};
        for (const hook of hooks) {
            if (hook.url === this.getHookUrl()) {
                console.log('Deleting existing hook');
                existingProps = hook
                await api.ProjectHooks.remove(response.id, hook.id);
            }
        }
        const tokenEntry = await this.tokenService.createGitpodToken(user, GitlabService.PREBUILD_TOKEN_SCOPE, cloneUrl);
        await api.ProjectHooks.add(response.id, this.getHookUrl(), <Partial<GitLab.ProjectHook>>{
            ...existingProps,
            push_events: true,
            token: user.id+'|'+tokenEntry.token.value
        });
        console.log('Installed Webhook for ' + cloneUrl);
    }

    async canAccessHeadlessLogs(user: User, context: WorkspaceContext): Promise<boolean> {
        if (!CommitContext.is(context)) {
            return false;
        }
        const { owner, name: repoName } = context.repository;

        try {
            // If we can "see" a project we are allowed to access it's headless logs
            const api = await this.api.create(user);
            const response = (await api.Projects.show(`${owner}/${repoName}`)) as unknown as GitLab.Project;
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