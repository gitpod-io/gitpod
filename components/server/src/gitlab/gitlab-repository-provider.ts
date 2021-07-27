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
        const avatarUrl = response.owner.avatar_url || undefined;
        const webUrl = response.web_url;
        return { host, owner, name, cloneUrl, description, avatarUrl, webUrl };
    }

    async getBranch(user: User, owner: string, repo: string, branch: string): Promise<Branch> {
        // todo
        throw new Error("not implemented");
    }

    async getBranches(user: User, owner: string, repo: string): Promise<Branch[]> {
        // todo
        return [];
    }

    async getCommitInfo(user: User, owner: string, repo: string, ref: string): Promise<CommitInfo | undefined> {
        // todo
        return undefined;
    }
}
