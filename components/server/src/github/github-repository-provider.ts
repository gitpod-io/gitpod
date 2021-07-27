/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';

import { User, Repository } from "@gitpod/gitpod-protocol"
import { GitHubRestApi } from "./api";
import { RepositoryProvider } from '../repohost/repository-provider';
import { parseRepoUrl } from '../repohost/repo-url';
import { Branch, CommitInfo } from '@gitpod/gitpod-protocol/src/protocol';

@injectable()
export class GithubRepositoryProvider implements RepositoryProvider {
    @inject(GitHubRestApi) protected readonly github: GitHubRestApi;

    async getRepo(user: User, owner: string, repo: string): Promise<Repository> {
        const repository = await this.github.getRepository(user, { owner, repo });
        const cloneUrl = repository.clone_url;
        const host = parseRepoUrl(cloneUrl)!.host;
        const description = repository.description;
        const avatarUrl = repository.owner.avatar_url;
        const webUrl = repository.html_url;
        const defaultBranch = repository.default_branch;
        return { host, owner, name: repo, cloneUrl, description, avatarUrl, webUrl, defaultBranch };
    }

    async getBranch(user: User, owner: string, repo: string, branch: string): Promise<Branch> {
        const result = await this.github.getBranch(user, { repo, owner, branch });
        return result;
    }

    async getBranches(user: User, owner: string, repo: string): Promise<Branch[]> {
        const branches = await this.github.getBranches(user, { repo, owner });
        return branches;
    }

    async getCommitInfo(user: User, owner: string, repo: string, ref: string): Promise<CommitInfo | undefined> {
        const commit = await this.github.getCommit(user, { repo, owner, ref });
        return commit;
    }
}
