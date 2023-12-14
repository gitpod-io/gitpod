/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { RepositoryService } from "../repohost/repo-service";
import { User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { GitLabApi, GitLab } from "../gitlab/api";
import { GitLabApp } from "./gitlab-app";
import { Config } from "../config";
import { TokenService } from "../user/token-service";
import { GitlabContextParser } from "../gitlab/gitlab-context-parser";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class GitlabService extends RepositoryService {
    static PREBUILD_TOKEN_SCOPE = "prebuilds";

    constructor(
        @inject(GitLabApi) protected api: GitLabApi,
        @inject(Config) private readonly config: Config,
        @inject(TokenService) private readonly tokenService: TokenService,
        @inject(GitlabContextParser) private readonly gitlabContextParser: GitlabContextParser,
    ) {
        super();
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

    private getHookUrl() {
        return this.config.hostUrl
            .asPublicServices()
            .with({
                pathname: GitLabApp.path,
            })
            .toString();
    }
}
