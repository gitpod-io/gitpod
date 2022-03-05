/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';

import { User, Repository } from "@gitpod/gitpod-protocol"
import { Gitea, GiteaRestApi } from "./api";
import { RepositoryProvider } from '../repohost/repository-provider';
import { RepoURL } from '../repohost/repo-url';
import { Branch, CommitInfo } from '@gitpod/gitpod-protocol/src/protocol';

@injectable()
export class GiteaRepositoryProvider implements RepositoryProvider {
    @inject(GiteaRestApi) protected readonly giteaApi: GiteaRestApi;

    async getRepo(user: User, owner: string, repoName: string): Promise<Repository> {
        const result = await this.giteaApi.run<Gitea.Repository>(user, (g => g.repos.repoGet(owner, repoName)));
        if (Gitea.ApiError.is(result)) {
            throw new Error(`Can't get repository ${owner}/${repoName}`);
		}

        if (!result.clone_url) {
            throw new Error(`Can't find clone_url for repository ${owner}/${repoName}`);
		}

        const host = RepoURL.parseRepoUrl(result.clone_url)!.host;
        return { host, owner, name: repoName, cloneUrl: result.clone_url, description: result.description, avatarUrl: result.avatar_url, webUrl: result.html_url, defaultBranch: result.default_branch };
    }

    async getBranch(user: User, owner: string, repoName: string, branch: string): Promise<Branch> {
        // TODO: we currently use ref as sha :thinking:
        const result = await this.giteaApi.run<Gitea.Branch>(user, (g => g.repos.repoGetBranch(owner, repoName, branch)));
        if (Gitea.ApiError.is(result)) {
            throw new Error(`Can't get branch ${branch} from repository ${owner}/${repoName}`);
		}

        if (!result.name || !result.commit?.author?.name || !result.commit?.message || !result.commit?.added) {
            throw new Error(`Missing relevant commit information for branch ${branch} from repository ${owner}/${repoName}`);
        }

        return {
            name: result.name,
            htmlUrl: '', // TODO: find way to get branch url / create it manually
            commit: {
                author: result.commit.author.name,
                sha: '', // TODO: find way to get branch sha
                commitMessage: result.commit.message,
                authorAvatarUrl: '', // TODO: find way to get author avatar
                authorDate: '', // TODO: find way to get author date
            },
        };
    }

    async getBranches(user: User, owner: string, repoName: string): Promise<Branch[]> {
        // TODO: we currently use ref as sha :thinking:
        const result = await this.giteaApi.run<Gitea.Branch[]>(user, (g => g.repos.repoListBranches(owner, repoName)));
        if (Gitea.ApiError.is(result)) {
            throw new Error(`Can't get branches from repository ${owner}/${repoName}`);
		}

        return result.map((branch) => {
            if (!branch.name || !branch.commit?.author?.name || !branch.commit?.message || branch.commit?.added) {
                throw new Error(`Missing relevant commit information for branch ${branch.name} from repository ${owner}/${repoName}`);
            }

            return {
                name: branch.name,
                htmlUrl: '', // TODO: find way to get branch url / create it manually
                commit: {
                    author: branch.commit.author.name,
                    sha: '', // TODO: find way to get branch sha
                    commitMessage: branch.commit.message,
                    authorAvatarUrl: '', // TODO: find way to get author avatar
                    authorDate: '', // TODO: find way to get author date
                },
            };
        });
    }

    async getCommitInfo(user: User, owner: string, repoName: string, ref: string): Promise<CommitInfo | undefined> {
        // TODO: we currently use ref as sha :thinking:
        const result = await this.giteaApi.run<Gitea.Commit>(user, (g => g.repos.repoGetSingleCommit(owner, repoName, ref)));
        if (Gitea.ApiError.is(result)) {
            throw new Error(`Can't get commit for ref ${ref} from repository ${owner}/${repoName}`);
		}

        if (!result.author?.login || !result.commit?.message || !result.sha) {
            throw new Error(`Missing relevant commit information for ref ${ref} from repository ${owner}/${repoName}`);
		}

        return {
            author: result.author?.login, // TODO: is this correct?
            commitMessage: result.commit?.message,
            sha: result.sha,
            authorAvatarUrl: result.author?.avatar_url,
            authorDate: result.created, // TODO: is this correct?
        };
    }

    async getUserRepos(user: User): Promise<string[]> {
        const result = await this.giteaApi.run<Gitea.Repository[]>(user, (g => g.user.userCurrentListRepos()));
        if (Gitea.ApiError.is(result)) {
            throw new Error(`Can't get repositories for user ${user.name}`);
		}

        // TODO: do we need the html url or clone urls?
        return (result || []).map((repo) => repo.html_url || '').filter(s => s !== "")
    }

    async hasReadAccess(user: User, owner: string, repo: string): Promise<boolean> {
        try {
            // If we can "see" a project we are allowed to read it
            const api = await this.giteaApi;
            const response = await api.run(user, (g => g.repos.repoGet(owner, repo)));
            if (Gitea.ApiError.is(response)) {
                return false;
            }
            return true;
        } catch (err) {
            return false;
        }
    }
}
