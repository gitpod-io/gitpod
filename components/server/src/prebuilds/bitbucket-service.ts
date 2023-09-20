/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { RepositoryService } from "../repohost/repo-service";
import { User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { BitbucketApiFactory } from "../bitbucket/bitbucket-api-factory";
import { AuthProviderParams } from "../auth/auth-provider";
import { BitbucketApp } from "./bitbucket-app";
import { Config } from "../config";
import { TokenService } from "../user/token-service";
import { BitbucketContextParser } from "../bitbucket/bitbucket-context-parser";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class BitbucketService extends RepositoryService {
    static PREBUILD_TOKEN_SCOPE = "prebuilds";

    constructor(
        @inject(BitbucketApiFactory) private api: BitbucketApiFactory,
        @inject(Config) private readonly config: Config,
        @inject(AuthProviderParams) private authProviderConfig: AuthProviderParams,
        @inject(TokenService) private tokenService: TokenService,
        @inject(BitbucketContextParser) private bitbucketContextParser: BitbucketContextParser,
    ) {
        super();
    }

    async canInstallAutomatedPrebuilds(user: User, cloneUrl: string): Promise<boolean> {
        const { host, owner, repoName } = await this.bitbucketContextParser.parseURL(user, cloneUrl);
        if (host !== this.authProviderConfig.host) {
            return false;
        }

        // only admins may install webhooks on repositories
        const api = await this.api.create(user);
        const response = await api.user.listPermissionsForRepos({
            q: `repository.full_name="${owner}/${repoName}"`,
        });
        return !!response.data?.values && response.data.values[0]?.permission === "admin";
    }

    async installAutomatedPrebuilds(user: User, cloneUrl: string): Promise<string> {
        try {
            const api = await this.api.create(user);
            const { owner, repoName } = await this.bitbucketContextParser.parseURL(user, cloneUrl);
            const existing = await api.repositories.listWebhooks({
                repo_slug: repoName,
                workspace: owner,
            });
            const hookUrl = this.getHookUrl();
            const existingGitpodHook = existing.data.values
                ? existing.data.values.find((hook) => hook.url && hook.url.indexOf(hookUrl) !== -1)
                : undefined;
            if (existingGitpodHook) {
                log.info(`bitbucket webhook already installed on ${owner}/${repoName}`);
                if (!existingGitpodHook.uuid) {
                    throw new ApplicationError(
                        ErrorCodes.CONFLICT,
                        `Couldn't install webhook for ${cloneUrl}: existing webhook has no uuid`,
                    );
                }
                return existingGitpodHook.uuid;
            }
            const tokenEntry = await this.tokenService.createGitpodToken(
                user,
                BitbucketService.PREBUILD_TOKEN_SCOPE,
                cloneUrl,
            );
            const response = await api.repositories.createWebhook({
                repo_slug: repoName,
                workspace: owner,
                // see https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/%7Bworkspace%7D/%7Brepo_slug%7D/hooks#post
                _body: {
                    description: `Gitpod Prebuilds for ${this.config.hostUrl}.`,
                    url: hookUrl + `?token=${user.id + "|" + tokenEntry.token.value}`,
                    active: true,
                    events: ["repo:push"],
                },
            });
            if (response.status !== 201) {
                throw new ApplicationError(
                    ErrorCodes.CONFLICT,
                    `Couldn't install webhook for ${cloneUrl}: ${response.status}`,
                );
            }
            log.info("Installed Bitbucket Webhook for " + cloneUrl);
            if (!response.data.uuid) {
                throw new ApplicationError(
                    ErrorCodes.CONFLICT,
                    `Couldn't install webhook for ${cloneUrl}: webhook has no uuid`,
                );
            }
            return response.data.uuid;
        } catch (error) {
            throw new ApplicationError(ErrorCodes.CONFLICT, `Couldn't install webhook for ${cloneUrl}: ` + error, {
                error,
            });
        }
    }

    async uninstallAutomatedPrebuilds(user: User, cloneUrl: string, webhookId: string): Promise<void> {
        const api = await this.api.create(user);
        const { owner, repoName } = await this.bitbucketContextParser.parseURL(user, cloneUrl);

        await api.repositories.deleteWebhook({
            uid: webhookId,
            repo_slug: repoName,
            workspace: owner,
        });
    }

    private getHookUrl() {
        return this.config.hostUrl
            .asPublicServices()
            .with({
                pathname: BitbucketApp.path,
            })
            .toString();
    }
}
