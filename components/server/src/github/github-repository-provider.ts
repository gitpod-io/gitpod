/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";

import { User, Repository } from "@gitpod/gitpod-protocol";
import { GitHubGraphQlEndpoint, GitHubRestApi } from "./api";
import { RepositoryProvider } from "../repohost/repository-provider";
import { RepoURL } from "../repohost/repo-url";
import { Branch, CommitInfo } from "@gitpod/gitpod-protocol/src/protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class GithubRepositoryProvider implements RepositoryProvider {
    @inject(GitHubRestApi) protected readonly github: GitHubRestApi;
    @inject(GitHubGraphQlEndpoint) protected readonly githubQueryApi: GitHubGraphQlEndpoint;

    async getRepo(user: User, owner: string, repo: string): Promise<Repository> {
        const repository = await this.github.getRepository(user, { owner, repo });
        const cloneUrl = repository.clone_url;
        const host = RepoURL.parseRepoUrl(cloneUrl)!.host;
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
        const branches: Branch[] = [];
        let endCursor: string | undefined;
        let hasNextPage: boolean = true;

        while (hasNextPage) {
            const result: any = await this.githubQueryApi.runQuery(
                user,
                `
                query {
                    repository(name: "${repo}", owner: "${owner}") {
                        refs(refPrefix: "refs/heads/", orderBy: {field: TAG_COMMIT_DATE, direction: ASC}, first: 100 ${
                            endCursor ? `, after: "${endCursor}"` : ""
                        }) {
                            nodes {
                                name
                                target {
                                    ... on Commit {
                                        oid
                                        history(first: 1) {
                                            nodes {
                                                messageHeadline
                                                committedDate
                                                oid
                                                authoredDate
                                                tree {
                                                    id
                                                }
                                                treeUrl
                                                author {
                                                    avatarUrl
                                                    name
                                                    date
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            pageInfo {
                                endCursor
                                hasNextPage
                                hasPreviousPage
                                startCursor
                            }
                            totalCount
                        }
                    }
                }
            `,
            );

            endCursor = result.data.repository?.refs?.pageInfo?.endCursor;
            hasNextPage = result.data.repository?.refs?.pageInfo?.hasNextPage;

            const nodes = result.data.repository?.refs?.nodes;
            for (const node of nodes || []) {
                branches.push({
                    name: node.name,
                    commit: {
                        sha: node.target.oid,
                        commitMessage: node.target.history.nodes[0].messageHeadline,
                        author: node.target.history.nodes[0].author.name,
                        authorAvatarUrl: node.target.history.nodes[0].author.avatarUrl,
                        authorDate: node.target.history.nodes[0].author.date,
                    },
                    htmlUrl: node.target.history.nodes[0].treeUrl.replace(node.target.oid, node.name),
                });
            }
        }
        return branches;
    }

    async getCommitInfo(user: User, owner: string, repo: string, ref: string): Promise<CommitInfo | undefined> {
        try {
            return await this.github.getCommit(user, { repo, owner, ref });
        } catch (error) {
            console.error(error);
            return undefined;
        }
    }

    public async getCommitHistory(
        user: User,
        owner: string,
        repo: string,
        ref: string,
        maxDepth: number = 100,
    ): Promise<string[]> {
        try {
            if (ref.length != 40) {
                throw new Error(`Invalid commit ID ${ref}.`);
            }

            // TODO(janx): To get more results than GitHub API's max page size (seems to be 100), pagination should be handled.
            // These additional history properties may be helfpul:
            //     totalCount,
            //     pageInfo {
            //         haxNextPage,
            //     },
            const result: any = await this.githubQueryApi.runQuery(
                user,
                `
                query {
                    repository(name: "${repo}", owner: "${owner}") {
                        object(oid: "${ref}") {
                            ... on Commit {
                                history(first: ${maxDepth}) {
                                    edges {
                                        node {
                                            oid
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `,
            );

            if (result.data.repository === null) {
                throw new Error(`couldn't find repository ${owner}/${repo} on ${this.github.baseURL}`);
            }

            const commit = result.data.repository.object;
            if (commit === null) {
                throw new Error(`Couldn't find commit ${ref} in repository ${owner}/${repo}.`);
            }

            return commit.history.edges.slice(1).map((e: any) => e.node.oid) || [];
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    async getUserRepos(user: User): Promise<string[]> {
        // Hint: Use this to get richer results:
        //   node {
        //       nameWithOwner
        //       shortDescriptionHTML(limit: 120)
        //       url
        //   }
        const result: any = await this.githubQueryApi.runQuery(
            user,
            `
            query {
                viewer {
                    repositoriesContributedTo(includeUserRepositories: true, first: 100) {
                        edges {
                            node {
                                url
                            }
                        }
                    }
                }
            }`,
        );
        return (result.data.viewer?.repositoriesContributedTo?.edges || []).map((edge: any) => edge.node.url);
    }

    async hasReadAccess(user: User, owner: string, repo: string): Promise<boolean> {
        try {
            // If you have no "viewerPermission" on a repository you may not read it
            // Ref: https://docs.github.com/en/graphql/reference/enums#repositorypermission
            const result: any = await this.githubQueryApi.runQuery(
                user,
                `
                query {
                    repository(name: "${repo}", owner: "${owner}") {
                        viewerPermission
                    }
                }
            `,
            );
            return result.data.repository !== null;
        } catch (err) {
            log.warn({ userId: user.id }, "hasReadAccess error", err, { owner, repo });
            return false;
        }
    }
}
