/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";

import { FileProvider, MaybeContent, RevisionNotFoundError } from "../repohost/file-provider";
import { Commit, User, Repository } from "@gitpod/gitpod-protocol";
import { GitLabApi, GitLab } from "./api";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class GitlabFileProvider implements FileProvider {
    @inject(GitLabApi) protected readonly gitlabApi: GitLabApi;

    public async getGitpodFileContent(commit: Commit, user: User): Promise<MaybeContent> {
        const yamlVersion1 = await Promise.all([
            this.getFileContent(commit, user, ".gitpod.yml"),
            this.getFileContent(commit, user, ".gitpod"),
        ]);
        return yamlVersion1.filter((f) => !!f)[0];
    }

    public async getLastChangeRevision(
        repository: Repository,
        revisionOrBranch: string,
        user: User,
        path: string,
    ): Promise<string> {
        const notFoundError = new RevisionNotFoundError(
            `File ${path} does not exist in repository ${repository.owner}/${repository.name}`,
        );

        const fileExists =
            (await this.getFileContent({ repository, revision: revisionOrBranch }, user, path)) !== undefined;
        if (!fileExists) {
            throw notFoundError;
        }

        const commitsResult = await this.gitlabApi.run<GitLab.Commit[]>(user, async (g) => {
            return g.Commits.all(`${repository.owner}/${repository.name}`, { path, refName: revisionOrBranch });
        });
        if (GitLab.ApiError.is(commitsResult)) {
            throw commitsResult;
        }

        const lastCommit = commitsResult[0];
        if (!lastCommit) {
            throw notFoundError;
        }

        return lastCommit.id;
    }

    public async getFileContent(commit: Commit, user: User, path: string): Promise<MaybeContent> {
        const org = commit.repository.owner;
        const name = commit.repository.name;
        const commitish = commit.revision;
        try {
            const result = await this.gitlabApi.getRawContents(user, org, name, commitish, path);
            return result;
        } catch (error) {
            log.debug(error);
        }
    }
}
