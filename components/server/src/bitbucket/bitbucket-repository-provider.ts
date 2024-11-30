/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Branch, CommitInfo, Repository, RepositoryInfo, User } from "@gitpod/gitpod-protocol";
import { Schema } from "bitbucket";
import { inject, injectable } from "inversify";
import { URL } from "url";
import { RepoURL } from "../repohost/repo-url";
import { RepositoryProvider } from "../repohost/repository-provider";
import { BitbucketApiFactory } from "./bitbucket-api-factory";
import asyncBatch from "async-batch";
import { handleBitbucketError } from "../bitbucket-server/utils";

@injectable()
export class BitbucketRepositoryProvider implements RepositoryProvider {
    @inject(BitbucketApiFactory) protected readonly apiFactory: BitbucketApiFactory;

    async getRepo(user: User, owner: string, name: string): Promise<Repository> {
        const api = await this.apiFactory.create(user);
        const repo = (await api.repositories.get({ workspace: owner, repo_slug: name })).data;
        let cloneUrl = repo.links!.clone!.find((x: any) => x.name === "https")!.href!;
        if (cloneUrl) {
            const url = new URL(cloneUrl);
            url.username = "";
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
            name: branchName,
        });

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
            },
        };
    }

    async getBranches(user: User, owner: string, repo: string): Promise<Branch[]> {
        const branches: Branch[] = [];
        const api = await this.apiFactory.create(user);

        // Handle pagination.
        let nextPage = 1;
        let isMoreDataAvailable = true;

        while (isMoreDataAvailable) {
            const response = await api.repositories.listBranches({
                workspace: owner,
                repo_slug: repo,
                sort: "target.date",
                page: String(nextPage),
                pagelen: 100,
            });

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
                    },
                });
            }

            // If the response has a "next" property, it indicates there are more pages.
            if (response.data.next) {
                nextPage++;
            } else {
                isMoreDataAvailable = false;
            }
        }

        return branches;
    }

    async getCommitInfo(user: User, owner: string, repo: string, ref: string): Promise<CommitInfo | undefined> {
        const api = await this.apiFactory.create(user);
        const response = await api.commits.get({
            workspace: owner,
            repo_slug: repo,
            commit: ref,
        });
        const commit = response.data;
        return {
            sha: commit.hash!,
            author: commit.author?.user?.display_name!,
            authorDate: commit.date!,
            commitMessage: commit.message || "missing commit message",
            authorAvatarUrl: commit.author?.user?.links?.avatar?.href,
        };
    }

    async getUserRepos(user: User): Promise<RepositoryInfo[]> {
        // FIXME(janx): Not implemented yet
        return [];
    }

    async hasReadAccess(user: User, owner: string, repo: string): Promise<boolean> {
        const api = await this.apiFactory.create(user);
        const result = await api.repositories.get({ workspace: owner, repo_slug: repo }).catch((e) => {
            const error = e instanceof Error ? handleBitbucketError(e) : e;
            console.warn({ userId: user.id }, "hasReadAccess error", error, { owner, repo });
            return null;
        });

        // we assume that if the current token is good to read the repository details,
        // then the repository is accessible
        return result !== null;
    }

    public async getCommitHistory(
        user: User,
        owner: string,
        repo: string,
        revision: string,
        maxDepth: number = 100,
    ): Promise<string[]> {
        const api = await this.apiFactory.create(user);
        // TODO(janx): To get more results than Bitbucket API's max pagelen (seems to be 100), pagination should be handled.
        // The additional property 'page' may be helpful.
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

    //
    // Searching Bitbucket requires a workspace to be specified
    // This results in a two step process:
    // 1. Get all workspaces for the user
    // 2. Fan out and search each workspace for the repos
    //
    public async searchRepos(user: User, searchString: string, limit: number): Promise<RepositoryInfo[]> {
        const api = await this.apiFactory.create(user);

        const workspaces = await api.workspaces.getWorkspaces({ pagelen: limit });

        const workspaceSlugs: string[] = (
            workspaces.data.values?.map((w) => {
                return w.slug || "";
            }) ?? []
        ).filter(Boolean);

        if (workspaceSlugs.length === 0) {
            return [];
        }

        // Batch our requests to the api so we only make up to 5 calls in parallel
        const results = await asyncBatch(
            workspaceSlugs,
            async (workspaceSlug) => {
                return api.repositories.list({
                    workspace: workspaceSlug,
                    // name includes searchString
                    q: `name ~ "${searchString}"`,
                    // sort by most recently updated first
                    sort: "-updated_on",
                    // limit to the first 10 results per workspace
                    pagelen: 10,
                });
            },
            // 5 calls in parallel
            5,
        );

        // Convert into RepositoryInfo
        const repos: RepositoryInfo[] = [];

        results
            .map((result) => {
                return result.data.values ?? [];
            })
            // flatten out the array of arrays
            .flat()
            // convert into the format we want to return
            .forEach((repo) => {
                const name = repo.name;
                const url = repo.links?.html?.href;
                if (name && url) {
                    repos.push({ name, url });
                }
            });

        return repos;
    }
}
