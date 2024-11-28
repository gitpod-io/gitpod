/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Branch, CommitInfo, Repository, RepositoryInfo, User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { RepoURL } from "../repohost";
import { RepositoryProvider } from "../repohost/repository-provider";
import { BitbucketServer, BitbucketServerApi } from "./bitbucket-server-api";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class BitbucketServerRepositoryProvider implements RepositoryProvider {
    @inject(BitbucketServerApi) protected api: BitbucketServerApi;

    protected async getOwnerKind(user: User, owner: string): Promise<"users" | "projects" | undefined> {
        try {
            await this.api.getProject(user, owner);
            return "projects";
        } catch (error) {
            // ignore
        }
        try {
            await this.api.getUserProfile(user, owner);
            return "users";
        } catch (error) {
            // ignore
        }
    }

    async getRepo(user: User, owner: string, name: string): Promise<Repository> {
        const repoKind = await this.getOwnerKind(user, owner);
        if (!repoKind) {
            throw new Error(`Could not find project "${owner}"`);
        }

        const repo = await this.api.getRepository(user, {
            repoKind,
            owner,
            repositorySlug: name,
        });
        const defaultBranch = await this.api.getDefaultBranch(user, {
            repoKind,
            owner,
            repositorySlug: name,
        });
        const cloneUrl = repo.links.clone.find((u) => u.name === "http")?.href!;
        const webUrl = repo.links?.self[0]?.href?.replace(/\/browse$/, "");
        const host = RepoURL.parseRepoUrl(cloneUrl)!.host;
        const avatarUrl = this.api.getAvatarUrl(owner);
        return {
            host,
            owner,
            name,
            cloneUrl,
            description: repo.description,
            avatarUrl,
            webUrl,
            defaultBranch: defaultBranch.displayId,
        };
    }

    async getBranch(user: User, owner: string, repo: string, branchName: string): Promise<Branch> {
        const repoKind = await this.getOwnerKind(user, owner);
        if (!repoKind) {
            throw new Error(`Could not find project "${owner}"`);
        }
        const branch = await this.api.getBranch(user, {
            repoKind,
            owner,
            repositorySlug: repo,
            branchName,
        });
        return this.toBranch(branch);
    }

    async getBranches(user: User, owner: string, repo: string): Promise<Branch[]> {
        const repoKind = await this.getOwnerKind(user, owner);
        if (!repoKind) {
            throw new Error(`Could not find project "${owner}"`);
        }
        const branchesResult = await this.api.getBranches(user, {
            repoKind,
            owner,
            repositorySlug: repo,
        });
        return branchesResult.map((entry) => this.toBranch(entry));
    }

    private toBranch(entry: BitbucketServer.BranchWithMeta): Branch {
        const commit = entry.latestCommitMetadata;
        return {
            htmlUrl: entry.htmlUrl,
            name: entry.displayId,
            commit: {
                sha: commit?.id ?? entry.latestCommit,
                author: commit?.author.displayName || "missing author",
                authorAvatarUrl: commit?.author.avatarUrl,
                authorDate: commit?.authorTimestamp ? new Date(commit.authorTimestamp).toISOString() : undefined,
                commitMessage: commit?.message || "missing commit message",
            },
        };
    }

    async getCommitInfo(user: User, owner: string, repo: string, ref: string): Promise<CommitInfo | undefined> {
        const repoKind = await this.getOwnerKind(user, owner);
        if (!repoKind) {
            throw new Error(`Could not find project "${owner}"`);
        }

        const commitsResult = await this.api.getCommits(user, {
            owner,
            repoKind,
            repositorySlug: repo,
            query: { shaOrRevision: ref, limit: 1 },
        });

        if (commitsResult.values && commitsResult.values[0]) {
            const commit = commitsResult.values[0];
            return {
                sha: commit.id,
                author: commit.author.displayName,
                authorDate: new Date(commit.authorTimestamp).toISOString(),
                commitMessage: commit.message || "missing commit message",
                authorAvatarUrl: commit.author.avatarUrl,
            };
        }
    }

    async getUserRepos(user: User): Promise<RepositoryInfo[]> {
        try {
            const repos = await this.api.getRecentRepos(user, { limit: 100 });
            const result: RepositoryInfo[] = [];
            repos.forEach((r) => {
                const cloneUrl = r.links.clone.find((u) => u.name === "http")?.href;
                if (cloneUrl) {
                    result.push({
                        url: cloneUrl.replace("http://", "https://"),
                        name: r.name,
                    });
                }
            });

            return result;
        } catch (error) {
            log.error("BitbucketServerRepositoryProvider.getUserRepos", error);
            return [];
        }
    }

    async hasReadAccess(user: User, owner: string, repo: string): Promise<boolean> {
        let canRead = false;

        try {
            const repository = await this.getRepo(user, owner, repo);
            canRead = !!repository;
            // errors are expected here in the case that user does not have read access
        } catch (e) {}

        return canRead;
    }

    async getCommitHistory(user: User, owner: string, repo: string, ref: string, maxDepth: number): Promise<string[]> {
        const repoKind = await this.getOwnerKind(user, owner);
        if (!repoKind) {
            throw new Error(`Could not find project "${owner}"`);
        }

        const commitsResult = await this.api.getCommits(user, {
            owner,
            repoKind,
            repositorySlug: repo,
            query: { shaOrRevision: ref, limit: 1000 }, // ft: why do we limit to 1000 and not maxDepth?
        });

        const commits = commitsResult.values || [];
        return commits.map((c) => c.id).slice(1);
    }

    public async searchRepos(user: User, searchString: string, limit: number): Promise<RepositoryInfo[]> {
        // Only load 1 page of limit results for our searchString
        const results = await this.api.getRepos(user, { maxPages: 1, limit, searchString });

        const repos: RepositoryInfo[] = [];
        results.forEach((r) => {
            const cloneUrl = r.links.clone.find((u) => u.name === "http")?.href;
            if (cloneUrl) {
                repos.push({
                    url: cloneUrl.replace("http://", "https://"),
                    name: r.name,
                });
            }
        });

        return repos;
    }
}
