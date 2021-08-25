/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';

import { User, Repository, Branch, CommitInfo } from "@gitpod/gitpod-protocol"
import { GitLabApi, GitLab } from "./api";
import { RepositoryProvider } from '../repohost/repository-provider';
import { parseRepoUrl } from '../repohost/repo-url';

import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

@injectable()
export class GitlabRepositoryProvider implements RepositoryProvider {
    @inject(GitLabApi) protected readonly gitlab: GitLabApi;

    async getRepo(user: User, owner: string, name: string): Promise<Repository> {
        const response = await this.gitlab.run<GitLab.Project>(user, async g => {
            return g.Projects.show(`${owner}/${name}`);
        });
        if (GitLab.ApiError.is(response)) {
            throw response;
        }
        const cloneUrl = response.http_url_to_repo;
        const description = response.default_branch;
        const host = parseRepoUrl(cloneUrl)!.host;
        const avatarUrl = response.owner?.avatar_url || undefined;
        const webUrl = response.web_url;
        const defaultBranch = response.default_branch
        return { host, owner, name, cloneUrl, description, avatarUrl, webUrl, defaultBranch };
    }

    async getBranch(user: User, owner: string, repo: string, branch: string): Promise<Branch> {
        const response = await this.gitlab.run<GitLab.Branch>(user, async g => {
            return g.Branches.show(`${owner}/${repo}`, branch);
        });
        if (GitLab.ApiError.is(response)) {
            throw response;
        }
        return {
            htmlUrl: response.web_url,
            name: response.name,
            commit: {
                sha: response.commit.id,
                author: response.commit.author_name,
                authorAvatarUrl: "", // TODO(at) fetch avatar URL
                authorDate: response.commit.authored_date,
                commitMessage: response.commit.message || "missing commit message",
            }
        };
    }

    async getBranches(user: User, owner: string, repo: string): Promise<Branch[]> {
        const branches: Branch[] = [];
        const response = await this.gitlab.run<GitLab.Branch[]>(user, async g => {
            return g.Branches.all(`${owner}/${repo}`);
        });
        if (GitLab.ApiError.is(response)) {
            throw response;
        }
        for (const b of response) {
            branches.push({
                htmlUrl: b.web_url,
                name: b.name,
                commit: {
                    sha: b.commit.id,
                    author: b.commit.author_name,
                    authorDate: b.commit.authored_date,
                    authorAvatarUrl: "", // TODO(at) fetch avatar URL
                    commitMessage: b.commit.message || "missing commit message",
                }
            })
        }
        return branches;
    }

    async getCommitInfo(user: User, owner: string, repo: string, ref: string): Promise<CommitInfo | undefined> {
        const response = await this.gitlab.run<GitLab.Commit>(user, async g => {
            return g.Commits.show(`${owner}/${repo}`, ref);
        });
        if (GitLab.ApiError.is(response)) {
            // throw response;
            log.debug("Failed to fetch commit.", { response });
            return undefined;
        }
        return {
            sha: response.id,
            author: response.author_name,
            authorDate: response.authored_date,
            commitMessage: response.message || "missing commit message",
            authorAvatarUrl: "",
        };
    }
}
