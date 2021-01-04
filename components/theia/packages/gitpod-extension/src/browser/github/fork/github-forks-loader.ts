/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { CancellationToken } from "@theia/core/lib/common/cancellation";
import { Repository, GitHosterRepo } from "../../githoster/model/types";
import * as protocol from "../github-model/github-protocol";
import { BatchLoader } from "../github-model/batch-loader";
import { GitHubEndpoint } from "../github-model/github-endpoint";
import { GitHubRestApi } from "../github-model/github-rest-api";
import { GitHubResult, GitHub } from "../github-model/github";
import { ForksLoader } from "../../githoster/fork/forks-loader";

@injectable()
export class GitHubForksLoader implements ForksLoader {

    constructor(
        @inject(GitHubEndpoint) protected readonly gitHubEndpoint: GitHubEndpoint,
        @inject(GitHubRestApi) protected readonly gitHubRestApi: GitHubRestApi
    ) {

    }

    async computeForkMenuOptions(originRepo: ForksLoader.Repo) {
        // if origin repo has a fork source repo, use it to find forks in other accounts
        let source = await this.getSourceRepository(originRepo);
        if (!source) {
            source = originRepo;
        }

        const createForkForOwners: string[] = [];
        const switchToForkOfOwners: string[] = [];

        const myLoginResult = await this.gitHubRestApi.getMyLogin();
        const myLogin = myLoginResult.data.login;
        const mayReadOrgs = GitHubResult.mayReadOrgs(myLoginResult);
        const mayWritePublic = GitHubResult.mayWritePublic(myLoginResult);

        // loading forks in user account and in organizations in parallel
        const loader = new BatchLoader(this.gitHubEndpoint);

        let forksInCandidateOrgsPromise: Promise<Repository[]> | undefined;
        let candidateOrgs: string[] | undefined;
        if (mayReadOrgs) {
            const authorizedOrgs = await this.gitHubRestApi.getAuthorizedOrganizations();

            // exclude current org if it's the owner of the origin repo
            candidateOrgs = authorizedOrgs.data.filter(org => org.login !== originRepo.owner).map(item => item.login);
            forksInCandidateOrgsPromise = this.getForksInOrganizations(source, candidateOrgs, loader);
        }
        const myForkPromise = this.getForkInUserAccount(source, myLogin, loader);
        await loader.load();

        const myFork = await myForkPromise;
        if (!!myFork) {
            switchToForkOfOwners.push(myFork.owner);
        } else if (mayWritePublic) {
            createForkForOwners.push(myLogin);
        }

        const forksInOtherOrgs = await forksInCandidateOrgsPromise;
        if (!!forksInOtherOrgs) {
            switchToForkOfOwners.push(...forksInOtherOrgs.map(x => x.owner));
        }

        if (mayWritePublic) {
            const orgsWithoutFork = forksInOtherOrgs && candidateOrgs && candidateOrgs.filter(org => !forksInOtherOrgs.some(fork => fork.owner == org));
            if (orgsWithoutFork) {
                createForkForOwners.push(...orgsWithoutFork);
            }
        }

        const missingPermissions = this.getMissingPermissions(myLoginResult)

        return { myLogin, createForkForOwners, switchToForkOfOwners, missingPermissions };
    }

    protected getMissingPermissions(myLoginResult: GitHub.Response<GitHub.UsersGetAuthenticatedResponse>) {
        const mayReadOrgs = GitHubResult.mayReadOrgs(myLoginResult);
        const mayWritePublic = GitHubResult.mayWritePublic(myLoginResult);

        const result: {
            scope: string,
            menuLabel: string,
            menuDescription: string,
            menuCompleteMessage: string
        }[] = [];

        if (!mayReadOrgs) {
            result.push({
                scope: "read:org",
                menuLabel: "Add permission to read your GitHub orgs.",
                menuDescription: "This will allow you to select and switch to forks in your GitHub organizations.",
                menuCompleteMessage: '"Access Control" to be opened in new tab, and permissions should be updated.',
            });
        }

        if (!mayWritePublic) {
            result.push({
                scope: "public_repo",
                menuLabel: "Add GitHub write permission.",
                menuDescription: "This will allow you to create forks in your GitHub account or organizations with permissions for Gitpod.",
                menuCompleteMessage: '"Access Control" to be opened in new tab, and permissions should be updated.',
            });
        }

        return result;
    }

    /**
     * Computes all forks of a given source repository within the given organizations.
     *
     * @param repo.owner owner of the source repository
     * @param repo.name name of the source repository
     * @param organizations organizations to search for forks
     */
    async getForksInOrganizations(repo: ForksLoader.Repo, organizations: string[], loader: BatchLoader): Promise<Repository[]> {
        if (organizations.length === 0) {
            return [];
        }
        const sourceNameWithOwner = `${repo.owner}/${repo.name}`;
        const result: Repository[] = [];
        for (const org of organizations) {
            const query = GitHubForksLoader.createGetOrganizationForksQuery(org);
            loader.batch<GitHubForksLoader.GetForksResult>(query, (data, error) => {
                if (data) {
                    const forks = GitHubForksLoader.getForks(data);
                    for (const fork of forks) {
                        const source = GitHubForksLoader.getSource(fork)
                        if (sourceNameWithOwner == source.nameWithOwner) {
                            result.push(this.toRepository(fork));
                        }
                    }
                }
                // if (error) {
                //     console.debug(error);
                // }
            });
        }
        await loader.done;
        return result;
    }

    /**
     * Looks up the fork of a given source repository within the account of the GH user.
     *
     * @param repo.owner owner of the source repository
     * @param repo.name name of the source repository
     */
    async getForkInUserAccount(repo: ForksLoader.Repo, userName: string, loader: BatchLoader): Promise<Repository | undefined> {
        const sourceNameWithOwner = `${repo.owner}/${repo.name}`;
        const query = GitHubForksLoader.createGetUserForksQuery(userName);
        const result: Repository[] = [];
        loader.batch<GitHubForksLoader.GetForksResult>(query, (data, error) => {
            if (data) {
                const forks = GitHubForksLoader.getForks(data);
                for (const fork of forks) {
                    const source = GitHubForksLoader.getSource(fork)
                    if (sourceNameWithOwner == source.nameWithOwner) {
                        result.push(this.toRepository(fork));
                    }
                }
                if (result.length > 1) {
                    console.error(`Unexpectedly found more than one fork: ${result.map(f => f.fullName).join(', ')}`);
                }
            }
            if (error) {
                console.error(error);
            }
        });
        await loader.done;

        return result[0];
    }

    protected toRepository(fork: GitHubForksLoader.Fork) {
        const pushPermission = protocol.RepositoryPermission.mayPush(fork.viewerPermission);
        const name = GitHubForksLoader.getRepoName(fork);
        const owner = GitHubForksLoader.getOwner(fork);
        return new Repository(name, owner, pushPermission);
    }

    async getForks(owner: string, repo: string, acceptor: (fork: Repository) => void, token: CancellationToken): Promise<void> {
        const repository = await this.getRepository(owner, repo);
        const source = repository && repository.source || repository;
        if (!source || token.isCancellationRequested) {
            return;
        }
        const api = await this.gitHubRestApi.create(); // uncached configuration; used for `hasNextPage` requests.
        const acceptForks = async (forks: GitHub.ReposListForksResponse) => {
            if (token.isCancellationRequested) {
                return;
            }
            for (const fork of forks) {
                await acceptFork(new Repository(fork.name, fork.owner.login), fork.forks_count);
            }
        }
        const acceptFork = async (repo: Repository, forkCount: number) => {
            if (token.isCancellationRequested) {
                return;
            }
            acceptor(repo);
            if (forkCount <= 0) {
                return;
            }
            try {
                for await (const response of api.paginate.iterator(api.repos.listForks.endpoint.merge({ repo: repo.name, owner: repo.owner, per_page: 100 }))) {
                    if (token.isCancellationRequested) {
                        return;
                    }
                    await acceptForks(response.data);
                }
            } catch (e) {
                console.debug('Failed to fetch forks', e, { repository: repo });
            }
        }
        await acceptFork(new Repository(source.name, source.owner.login), source.forks_count);
    }

    async getRepository(owner: string, repo: string): Promise<GitHosterRepo | undefined> {
        const fullName = owner + '/' + repo;
        try {
            const response = await this.gitHubRestApi.runWithCache<GitHub.ReposGetResponse>('getRepository:' + fullName, (api: GitHub) => api.repos.get({ owner, repo }));
            return response.data as any as GitHosterRepo;
        } catch (e) {
            console.debug('Failed to fetch repository', e, { repository: fullName });
            return undefined;
        }
    }

    async getSourceRepository(repo: ForksLoader.Repo): Promise<ForksLoader.Repo | undefined> {
        const fork = await this.getRepository(repo.owner, repo.name);
        if (fork && fork.source) {
            return {
                name: fork.source.name,
                owner: fork.source.owner.login
            }
        }
        return undefined;
    }

}

export namespace GitHubForksLoader {

    export interface GetForksResult {
        repositories: {
            nodes: GitHubForksLoader.Fork[]
        }
    }

    export function getForks(result: GetForksResult) {
        return result.repositories.nodes;
    }

    /**
     * cf. GetForksResult
     */
    export function createGetOrganizationForksQuery(org: string): string {
        // the max depth of queries should be respected, otherwise:
        // > ERROR: Query has depth of 54, which exceeds max depth of 25
        const maxExpectedDepthOfForks = 20;

        return `organization(login: "${org}") {
            repositories(first: ${GitHubEndpoint.nodeLimit}, isFork: true, isLocked: false) {
                nodes {
                    nameWithOwner
                    viewerPermission
                    ${"parent { nameWithOwner ".repeat(maxExpectedDepthOfForks) + " } ".repeat(maxExpectedDepthOfForks)}
                }
            }
        }
        `
    }

    /**
     * cf. GetForksResult
     */
    export function createGetUserForksQuery(userName: string): string {
        // the max depth of queries should be respected, otherwise:
        // > ERROR: Query has depth of 54, which exceeds max depth of 25
        const maxExpectedDepthOfForks = 20;

        return `user(login: "${userName}") {
            repositories(first: ${GitHubEndpoint.nodeLimit}, isFork: true, isLocked: false) {
                nodes {
                    nameWithOwner
                    viewerPermission
                    ${"parent { nameWithOwner ".repeat(maxExpectedDepthOfForks) + " } ".repeat(maxExpectedDepthOfForks)}
                }
            }
        }
        `
    }

    export function getRepoName(fork: ForkReference): string {
        return fork.nameWithOwner.split('/')[1];
    }

    export function getOwner(fork: ForkReference): string {
        return fork.nameWithOwner.split('/')[0];
    }

    export function getSource(fork: ForkReference): ForkReference {
        let current = fork;
        while (current.parent) {
            current = current.parent;
        }
        return current;
    }

    export interface Fork extends Node, ForkReference {
        viewerPermission: protocol.RepositoryPermission | null;
    }

    export interface ForkReference {
        nameWithOwner: string;
        parent: ForkReference | null;
    }

}
