/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Branch, CommitInfo, Repository, User } from "@gitpod/gitpod-protocol";
import { Schema } from "bitbucket";
import { inject, injectable } from 'inversify';
import { URL } from "url";
import { RepoURL } from '../repohost/repo-url';
import { RepositoryProvider } from '../repohost/repository-provider';
import { BitbucketApiFactory } from './bitbucket-api-factory';

@injectable()
export class BitbucketRepositoryProvider implements RepositoryProvider {

    @inject(BitbucketApiFactory) protected readonly apiFactory: BitbucketApiFactory;

    async getRepo(user: User, owner: string, name: string): Promise<Repository> {
        const api = await this.apiFactory.create(user);
        const repo = (await api.repositories.get({ workspace: owner, repo_slug: name })).data;
        let cloneUrl = repo.links!.clone!.find((x: any) => x.name === "https")!.href!;
        if (cloneUrl) {
            const url = new URL(cloneUrl);
            url.username = '';
            cloneUrl = url.toString();
        }
        const host = RepoURL.parseRepoUrl(cloneUrl)!.host;
        const description = repo.description;
        const avatarUrl = repo.owner!.links!.avatar!.href;
        const webUrl = repo.links!.html!.href;
        const defaultBranch = repo.mainbranch?.name;
        return { host, owner, name, cloneUrl, description, avatarUrl, webUrl, defaultBranch };
    }

    async getBranch(user: User, owner: string, repo: string, branchName: string): Promise<Branch> {
        const api = await this.apiFactory.create(user);
        const response = await api.repositories.getBranch({
            workspace: owner,
            repo_slug: repo,
            name: branchName
        })

        const branch = response.data;

        return {
            htmlUrl: branch.links?.html?.href!,
            name: branch.name!,
            commit: {
                sha: branch.target?.hash!,
                author: branch.target?.author?.user?.display_name!,
                authorAvatarUrl: branch.target?.author?.user?.links?.avatar?.href,
                authorDate: branch.target?.date!,
                commitMessage: branch.target?.message || "missing commit message",
            }
        };
    }

    async getBranches(user: User, owner: string, repo: string): Promise<Branch[]> {
        const branches: Branch[] = [];
        const api = await this.apiFactory.create(user);
        const response = await api.repositories.listBranches({
            workspace: owner,
            repo_slug: repo,
            sort: "target.date"
        })

        for (const branch of response.data.values!) {
            branches.push({
                htmlUrl: branch.links?.html?.href!,
                name: branch.name!,
                commit: {
                    sha: branch.target?.hash!,
                    author: branch.target?.author?.user?.display_name!,
                    authorAvatarUrl: branch.target?.author?.user?.links?.avatar?.href,
                    authorDate: branch.target?.date!,
                    commitMessage: branch.target?.message || "missing commit message",
                }
            });
        }

        return branches;
    }

    async getCommitInfo(user: User, owner: string, repo: string, ref: string): Promise<CommitInfo | undefined> {
        const api = await this.apiFactory.create(user);
        const response = await api.commits.get({
            workspace: owner,
            repo_slug: repo,
            commit: ref
        })
        const commit = response.data;
        return {
            sha: commit.hash!,
            author: commit.author?.user?.display_name!,
            authorDate: commit.date!,
            commitMessage: commit.message || "missing commit message",
            authorAvatarUrl: commit.author?.user?.links?.avatar?.href,
        };
    }

    async getUserRepos(user: User): Promise<string[]> {
        // FIXME(janx): Not implemented yet
        return [];
    }

    public async getCommitHistory(user: User, owner: string, repo: string, revision: string, maxDepth: number = 100): Promise<string[]> {
        const api = await this.apiFactory.create(user);
        // TODO(janx): To get more results than Bitbucket API's max pagelen (seems to be 100), pagination should be handled.
        // The additional property 'page' may be helfpul.
        const result = await api.repositories.listCommitsAt({
            workspace: owner,
            repo_slug: repo,
            revision: revision,
            pagelen: maxDepth,
        });

        const commits = result.data.values?.slice(1);
        if (!commits) {
            return [];
        }
        return commits.map((v: Schema.Commit) => v.hash!);
    }
}
