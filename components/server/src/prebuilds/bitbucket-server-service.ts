/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { RepositoryService } from "../repohost/repo-service";
import { ProviderRepository, User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { BitbucketServerApi } from "../bitbucket-server/bitbucket-server-api";
import { BitbucketServerContextParser } from "../bitbucket-server/bitbucket-server-context-parser";
import { Config } from "../config";
import { TokenService } from "../user/token-service";
import { BitbucketServerApp } from "./bitbucket-server-app";
import { CancellationToken } from "vscode-jsonrpc";

@injectable()
export class BitbucketServerService extends RepositoryService {
    static PREBUILD_TOKEN_SCOPE = "prebuilds";

    constructor(
        @inject(BitbucketServerApi) private readonly api: BitbucketServerApi,
        @inject(Config) private readonly config: Config,
        @inject(TokenService) private readonly tokenService: TokenService,
        @inject(BitbucketServerContextParser) private readonly contextParser: BitbucketServerContextParser,
    ) {
        super();
    }

    async getRepositoriesForAutomatedPrebuilds(
        user: User,
        params: { searchString: string; limit?: number; maxPages?: number; cancellationToken?: CancellationToken },
    ): Promise<ProviderRepository[]> {
        const repos = await this.api.getRepos(user, { permission: "REPO_ADMIN", ...params });
        return repos.map((r) => {
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

    async installAutomatedPrebuilds(user: User, cloneUrl: string): Promise<void> {
        const { owner, repoName, repoKind } = await this.contextParser.parseURL(user, cloneUrl);

        const existing = await this.api.getWebhooks(user, {
            repoKind,
            repositorySlug: repoName,
            owner,
        });
        const hookUrl = this.getHookUrl();
        if (existing.values?.some((hook) => hook.url && hook.url.indexOf(hookUrl) !== -1)) {
            console.log("BBS webhook already installed.", { cloneUrl });
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
                    url: hookUrl + `?token=${encodeURIComponent(`${user.id}|${tokenEntry.token.value}`)}`,
                    events: ["repo:refs_changed"],
                },
            );
            console.log("BBS: webhook installed.", { cloneUrl });
        } catch (error) {
            console.error("BBS: webhook installation failed.", error, { cloneUrl, error });
        }
    }

    protected getHookUrl() {
        return this.config.hostUrl
            .asPublicServices()
            .with({
                pathname: BitbucketServerApp.path,
            })
            .toString();
    }
}
