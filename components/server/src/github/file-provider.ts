/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";

import { FileProvider, MaybeContent } from "../repohost/file-provider";
import { Commit, User, Repository } from "@gitpod/gitpod-protocol";
import { GitHubRestApi } from "./api";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class GithubFileProvider implements FileProvider {
    @inject(GitHubRestApi) protected readonly githubApi: GitHubRestApi;

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
        const commits = (
            await this.githubApi.run(user, (gh) =>
                gh.repos.listCommits({
                    owner: repository.owner,
                    repo: repository.name,
                    sha: revisionOrBranch,
                    // per_page: 1, // we need just the last one right?
                    path,
                }),
            )
        ).data;

        const lastCommit = commits && commits[0];
        if (!lastCommit) {
            throw new Error(`File ${path} does not exist in repository ${repository.owner}/${repository.name}`);
        }

        return lastCommit.sha;
    }

    public async getFileContent(commit: Commit, user: User, path: string) {
        if (!commit.revision) {
            return undefined;
        }

        try {
            const response = await this.githubApi.run(user, (api) =>
                api.repos.getContent({
                    owner: commit.repository.owner,
                    repo: commit.repository.name,
                    path,
                    ref: commit.revision,
                    headers: {
                        accept: "application/vnd.github.VERSION.raw",
                    },
                }),
            );
            if (response.status === 200) {
                if (typeof response.data === "string") {
                    return response.data;
                }
                console.warn("GithubFileProvider.getFileContent – unexpected response type.", {
                    headers: response.headers,
                    type: typeof response.data,
                });
            }
            return undefined;
        } catch (err) {
            log.debug(err);
        }
    }
}
