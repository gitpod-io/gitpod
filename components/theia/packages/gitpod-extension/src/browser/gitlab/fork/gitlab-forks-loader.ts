/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { CancellationToken } from "@theia/core/lib/common/cancellation";
import { Gitlab } from 'gitlab';
import { GetResponse, PaginationResponse } from "gitlab/dist/types/core/infrastructure";
import { inject, injectable } from "inversify";
import { ForksLoader } from "../../githoster/fork/forks-loader";
import { GitHosterRepo, Repository } from "../../githoster/model/types";
import { GitpodGitTokenProvider } from "../../gitpod-git-token-provider";
import { GitLabApiCommons } from "../gitlab-api-commons";
import { GitLabExtension } from "../gitlab-extension";

@injectable()
export class GitLabForksLoader implements ForksLoader {

    @inject(GitLabExtension)
    protected readonly extension: GitLabExtension;

    @inject(GitpodGitTokenProvider)
    protected readonly tokenProvider: GitpodGitTokenProvider;

    async gitlabApi() {
        const { host } = this.extension;
        const token = await this.tokenProvider.getGitToken({ host });
        return new Gitlab({
            oauthToken: token.token,
            host: `https://${host}`
        });
    }


    async computeForkMenuOptions(originRepo: ForksLoader.Repo) {
        const fullRepoName = `${originRepo.owner}/${originRepo.name}`;

        try {
            const api = await this.gitlabApi();

            const currentUser = await GitLabApiCommons.getCurrentUser(api);
            if (!currentUser) {
                throw new Error("Could not find current GitLab user.");
            }

            const createForkForOwners: string[] = [];
            const switchToForkOfOwners: string[] = [];

            const myLogin = currentUser.username;

            if (myLogin === originRepo.owner) {
                // originRepo is already the repo of the user
            } else {
                const myforks = await this.getForksOwnedByUser(fullRepoName);
                const myFork = myforks.length == 1 ? myforks[0] : myforks.find(myfork => myfork.owner == myLogin);

                if (!!myFork) {
                    switchToForkOfOwners.push(myFork.owner);
                } else {
                    createForkForOwners.push(myLogin);
                }
            }

            // TODO: support organizations aka groups to fork to

            return { myLogin, createForkForOwners, switchToForkOfOwners, missingPermissions: [] };
        } catch (e) {
            console.error(e);
            throw e;
        };
    }

    private async getForksOwnedByUser(repo: string): Promise<Repository[]> {
        const api = await this.gitlabApi();
        const forks = await api.Projects.forks(repo, { owned: true });
        return this.forksToRepositories(forks);
    }

    private async getAllForks(repo: string): Promise<Repository[]> {
        const api = await this.gitlabApi();
        const forks = await api.Projects.forks(repo);
        return this.forksToRepositories(forks);
    }

    private forksToRepositories(forks: GetResponse): Repository[] {
        if (this.isPaginationResponse(forks)) {
            if (forks.pagination.totalPages > 1) {
                // TODO: Support pagination
                console.error("pagination has more pages");
            }
            return forks.data.map(fork => new Repository((fork as any).path, (fork as any).namespace.path));
        } else if (Array.isArray(forks)) {
            return forks.map(fork => new Repository((fork as any).path, (fork as any).namespace.path));
        } else if ((forks as any).path) {
            return [new Repository((forks as any).path, (forks as any).namespace.path)];
        }
        throw new Error("could not parse forks");
    }

    private isPaginationResponse(x: any): x is PaginationResponse {
        return !!x.data && !!x.pagination;
    }

    async getForks(owner: string, repo: string, acceptor: (fork: Repository) => void, token: CancellationToken): Promise<void> {
        try {
            const forks = await this.getAllForks(`${owner}/${repo}`);
            forks.some(fork => {
                acceptor(fork);
                return token.isCancellationRequested;
            });
        } catch {
            console.error("error getting forks from gitlab");
        }
    }

    async getRepository(owner: string, repo: string): Promise<GitHosterRepo | undefined> {
        try {
            const api = await this.gitlabApi();
            const project = await api.Projects.show(`${owner}/${repo}`);
            return {
                ...project,
                parent: undefined,
                source: undefined,
                owner: { login: project.owner.name }
            }
        } catch {
            console.error("error getting project from gitlab");
        }
        return undefined;
    }
}