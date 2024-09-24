/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { RepositoryService } from "../repohost/repo-service";
import { User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { BitbucketApiFactory } from "../bitbucket/bitbucket-api-factory";
import { BitbucketApp } from "./bitbucket-app";
import { Config } from "../config";
import { BitbucketContextParser } from "../bitbucket/bitbucket-context-parser";

@injectable()
export class BitbucketService extends RepositoryService {
    constructor(
        @inject(BitbucketApiFactory) private readonly api: BitbucketApiFactory,
        @inject(Config) private readonly config: Config,
        @inject(BitbucketContextParser) private readonly bitbucketContextParser: BitbucketContextParser,
    ) {
        super();
    }

    public async isGitpodWebhookEnabled(user: User, cloneUrl: string): Promise<boolean> {
        try {
            const api = await this.api.create(user);
            const { owner, repoName } = await this.bitbucketContextParser.parseURL(user, cloneUrl);
            const hooks = await api.repositories.listWebhooks({
                repo_slug: repoName,
                workspace: owner,
            });
            if (!hooks.data.values) {
                return false;
            }
            return hooks.data.values.some((hook) => hook.url === this.getHookUrl());
        } catch (error) {
            console.error("Failed to check if Gitpod webhook is enabled.", error, { cloneUrl });

            return false;
        }
    }

    protected getHookUrl() {
        return this.config.hostUrl
            .asPublicServices()
            .with({
                pathname: BitbucketApp.path,
            })
            .toString();
    }
}
