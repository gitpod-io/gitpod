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
import { RepoURL } from "../repohost";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { UnauthorizedRepositoryAccessError } from "@gitpod/public-api-common/lib/public-api-errors";
import { UnauthorizedError } from "../errors";
import { GitLabScope } from "../gitlab/scopes";
import { containsScopes } from "./token-scopes-inclusion";

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
        const parsedRepoUrl = RepoURL.parseRepoUrl(cloneUrl);
        if (!parsedRepoUrl) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Clone URL not parseable.`);
        }

        let api;
        try {
            api = await this.api.create(user); // throw UnauthorizedError
        } catch (error) {
            if (error instanceof UnauthorizedRepositoryAccessError) {
                error.info.host = parsedRepoUrl.host;
                error.info.providerIsConnected = false;
                error.info.providerType = "GitLab";
            }
            throw error;
        }

        let tokenEntry;
        try {
            // throws GitLabApiError 404
            const { owner, repoName } = await this.gitlabContextParser.parseURL(user, cloneUrl);
            const gitlabProjectId = `${owner}/${repoName}`;
            // throws GitLabApiError 403
            const hooks = (await api.ProjectHooks.all(gitlabProjectId)) as unknown as GitLab.ProjectHook[];
            if (GitLab.ApiError.is(hooks)) {
                throw hooks;
            }
            let existingProps: any = {};
            for (const hook of hooks) {
                if (hook.url === this.getHookUrl()) {
                    log.info("Deleting existing hook");
                    existingProps = hook;
                    // throws GitLabApiError 403
                    await api.ProjectHooks.remove(gitlabProjectId, hook.id);
                }
            }
            tokenEntry = await this.tokenService.createGitpodToken(user, GitlabService.PREBUILD_TOKEN_SCOPE, cloneUrl);
            // throws GitLabApiError 403
            await api.ProjectHooks.add(gitlabProjectId, this.getHookUrl(), <Partial<GitLab.ProjectHook>>{
                ...existingProps,
                push_events: true,
                token: user.id + "|" + tokenEntry.token.value,
            });
            log.info("Installed Webhook for " + cloneUrl, { cloneUrl, userId: user.id });
        } catch (error) {
            if (GitLab.ApiError.is(error)) {
                // TODO check for `error.code`

                throw UnauthorizedError.create({
                    host: parsedRepoUrl.host,
                    providerType: "GitLab",
                    repoName: parsedRepoUrl.repo,
                    requiredScopes: GitLabScope.Requirements.REPO,
                    providerIsConnected: true,
                    isMissingScopes: containsScopes(tokenEntry?.token?.scopes, GitLabScope.Requirements.REPO),
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
