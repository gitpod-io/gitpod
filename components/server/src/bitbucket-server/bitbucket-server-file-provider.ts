/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Commit, Repository, User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { FileProvider, MaybeContent } from "../repohost/file-provider";
import { BitbucketServerApi } from "./bitbucket-server-api";

@injectable()
export class BitbucketServerFileProvider implements FileProvider {
    @inject(BitbucketServerApi) protected api: BitbucketServerApi;

    public async getGitpodFileContent(commit: Commit, user: User): Promise<MaybeContent> {
        return this.getFileContent(commit, user, ".gitpod.yml");
    }

    public async getLastChangeRevision(
        repository: Repository,
        revisionOrBranch: string,
        user: User,
        path: string,
    ): Promise<string> {
        const { owner, name, repoKind } = repository;

        if (!repoKind) {
            throw new Error("Repo kind is missing.");
        }

        const result = await this.api.getCommits(user, {
            owner,
            repoKind,
            repositorySlug: name,
            query: { limit: 1, path, shaOrRevision: revisionOrBranch },
        });
        const lastCommit = result.values?.[0]?.id;
        if (!lastCommit) {
            throw new Error(`File ${path} does not exist in repository ${repository.owner}/${repository.name}`);
        }

        return lastCommit;
    }

    public async getFileContent(commit: Commit, user: User, path: string) {
        if (!commit.revision || !commit.repository.webUrl) {
            return undefined;
        }
        const { owner, name, repoKind } = commit.repository;

        try {
            // @see https://developer.atlassian.com/server/bitbucket/rest/v811/api-group-repository/#api-api-latest-projects-projectkey-repos-repositoryslug-raw-path-get
            const result = await this.api.fetchContent(
                user,
                `/${repoKind}/${owner}/repos/${name}/raw/${path}?at=${commit.revision}`,
            );
            return result;
        } catch (err) {
            console.debug({ userId: user.id }, err);
        }
    }
}
