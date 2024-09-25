/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { RepositoryService } from "../repohost/repo-service";
import { User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { BitbucketServerApi } from "../bitbucket-server/bitbucket-server-api";
import { BitbucketServerContextParser } from "../bitbucket-server/bitbucket-server-context-parser";
import { Config } from "../config";
import { BitbucketServerApp } from "./bitbucket-server-app";

@injectable()
export class BitbucketServerService extends RepositoryService {
    constructor(
        @inject(BitbucketServerApi) private readonly api: BitbucketServerApi,
        @inject(Config) private readonly config: Config,
        @inject(BitbucketServerContextParser) private readonly contextParser: BitbucketServerContextParser,
    ) {
        super();
    }

    public async isGitpodWebhookEnabled(user: User, cloneUrl: string): Promise<boolean> {
        try {
            const { owner, repoName, repoKind } = await this.contextParser.parseURL(user, cloneUrl);
            const existing = await this.api.getWebhooks(user, {
                repoKind,
                repositorySlug: repoName,
                owner,
            });
            if (!existing.values) {
                return false;
            }
            const hookUrl = this.getHookUrl();

            return existing.values.some((hook) => hook.url && hook.url.includes(hookUrl));
        } catch (error) {
            console.error("Failed to check if Gitpod webhook is enabled.", error, { cloneUrl });

            return false;
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
