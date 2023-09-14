/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Branch, CommitInfo, Repository, RepositoryInfo, User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { RepoURL } from "../repohost";
import { RepositoryProvider } from "../repohost/repository-provider";
import { BitbucketServerApi } from "./bitbucket-server-api";
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
        const commit = branch.latestCommitMetadata;

        return {
            htmlUrl: branch.htmlUrl,
            name: branch.displayId,
            commit: {
                sha: commit.id,
                author: commit.author.displayName,
                authorAvatarUrl: commit.author.avatarUrl,
                authorDate: new Date(commit.authorTimestamp).toISOString(),
                commitMessage: commit.message || "missing commit message",
            },
        };
    }

    async getBranches(user: User, owner: string, repo: string): Promise<Branch[]> {
        const branches: Branch[] = [];

        const repoKind = await this.getOwnerKind(user, owner);
        if (!repoKind) {
            throw new Error(`Could not find project "${owner}"`);
        }
        const branchesResult = await this.api.getBranches(user, {
            repoKind,
            owner,
            repositorySlug: repo,
        });
        for (const entry of branchesResult) {
            const commit = entry.latestCommitMetadata;

            branches.push({
                htmlUrl: entry.htmlUrl,
                name: entry.displayId,
                commit: {
                    sha: commit.id,
                    author: commit.author.displayName,
                    authorAvatarUrl: commit.author.avatarUrl,
                    authorDate: new Date(commit.authorTimestamp).toISOString(),
                    commitMessage: commit.message || "missing commit message",
                },
            });
        }

        return branches;
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
            // TODO: implement incremental search
            const repos = await this.api.getRepos(user, { maxPages: 10, permission: "REPO_READ" });
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
        // TODO(janx): Not implemented yet
        return false;
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
            query: { shaOrRevision: ref, limit: 1000 },
        });

        const commits = commitsResult.values || [];
        return commits.map((c) => c.id);
    }
}
