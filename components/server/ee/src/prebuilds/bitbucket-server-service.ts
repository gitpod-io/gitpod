/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { RepositoryService } from "../../../src/repohost/repo-service";
import { ProviderRepository, User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { BitbucketServerApi } from "../../../src/bitbucket-server/bitbucket-server-api";
import { AuthProviderParams } from "../../../src/auth/auth-provider";
import { BitbucketServerContextParser } from "../../../src/bitbucket-server/bitbucket-server-context-parser";
import { Config } from "../../../src/config";
import { TokenService } from "../../../src/user/token-service";
import { BitbucketServerApp } from "./bitbucket-server-app";

@injectable()
export class BitbucketServerService extends RepositoryService {
    static PREBUILD_TOKEN_SCOPE = "prebuilds";

    @inject(BitbucketServerApi) protected api: BitbucketServerApi;
    @inject(Config) protected readonly config: Config;
    @inject(AuthProviderParams) protected authProviderConfig: AuthProviderParams;
    @inject(TokenService) protected tokenService: TokenService;
    @inject(BitbucketServerContextParser) protected contextParser: BitbucketServerContextParser;

    async getRepositoriesForAutomatedPrebuilds(user: User): Promise<ProviderRepository[]> {
        const repos = await this.api.getRepos(user, { limit: 100, permission: "REPO_ADMIN" });
        return (repos.values || []).map((r) => {
            const cloneUrl = r.links.clone.find((u) => u.name === "http")?.href!;
            // const webUrl = r.links?.self[0]?.href?.replace("/browse", "");
            const accountAvatarUrl = this.api.getAvatarUrl(r.project.key);
            return <ProviderRepository>{
                name: r.name,
                cloneUrl,
                account: r.project.key,
                accountAvatarUrl,
                // updatedAt: TODO(at): this isn't provided directly
            };
        });
    }

    async canInstallAutomatedPrebuilds(user: User, cloneUrl: string): Promise<boolean> {
        const { host, repoKind, owner, repoName } = await this.contextParser.parseURL(user, cloneUrl);
        if (host !== this.authProviderConfig.host) {
            return false;
        }

        const identity = user.identities.find((i) => i.authProviderId === this.authProviderConfig.id);
        if (!identity) {
            console.error(`BBS: no identity found.`, { host: this.authProviderConfig.host, userId: user.id, cloneUrl });
            return false;
        }

        try {
            await this.api.getWebhooks(user, { repoKind, repositorySlug: repoName, owner });
            // reading webhooks to check if admin scope is provided
        } catch (error) {
            console.log(`BBS: could not read webhooks.`, error, { error, cloneUrl });
            return false;
        }

        if (repoKind === "users") {
            const ownProfile = await this.api.getUserProfile(user, identity.authName);
            if (owner === ownProfile.slug) {
                return true;
            }
        }

        let permission = await this.api.getPermission(user, { username: identity.authName, repoKind, owner, repoName });
        if (!permission && repoKind === "projects") {
            permission = await this.api.getPermission(user, { username: identity.authName, repoKind, owner });
        }

        if (this.hasPermissionToCreateWebhooks(permission)) {
            return true;
        }

        console.log(`BBS: Not allowed to install webhooks.`, { permission });
        return false;
    }

    protected hasPermissionToCreateWebhooks(permission: string | undefined) {
        return permission && ["REPO_ADMIN", "PROJECT_ADMIN"].indexOf(permission) !== -1;
    }

    async installAutomatedPrebuilds(user: User, cloneUrl: string): Promise<void> {
        const { owner, repoName, repoKind } = await this.contextParser.parseURL(user, cloneUrl);

        const existing = await this.api.getWebhooks(user, {
            repoKind,
            repositorySlug: repoName,
            owner,
        });
        const hookUrl = this.getHookUrl();
        if (existing.values && existing.values.some((hook) => hook.url && hook.url.indexOf(hookUrl) !== -1)) {
            console.log(`BBS webhook already installed.`, { cloneUrl });
            return;
        }
        const tokenEntry = await this.tokenService.createGitpodToken(
            user,
            BitbucketServerService.PREBUILD_TOKEN_SCOPE,
            cloneUrl,
        );
        try {
            await this.api.setWebhook(
                user,
                { repoKind, repositorySlug: repoName, owner },
                {
                    name: `Gitpod Prebuilds for ${this.config.hostUrl}.`,
                    active: true,
                    configuration: {
                        secret: "foobar123-secret",
                    },
                    url: hookUrl + `?token=${encodeURIComponent(user.id + "|" + tokenEntry.token.value)}`,
                    events: ["repo:refs_changed"],
                },
            );
            console.log("BBS: webhook installed.", { cloneUrl });
        } catch (error) {
            console.error(`BBS: webhook installation failed.`, error, { cloneUrl, error });
        }
    }

    protected getHookUrl() {
        return this.config.hostUrl
            .with({
                pathname: BitbucketServerApp.path,
            })
            .toString();
    }
}
