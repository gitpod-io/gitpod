/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Branch, CommitInfo, Repository, User } from "@gitpod/gitpod-protocol";
import { injectable } from 'inversify';
import { RepositoryProvider } from '../repohost/repository-provider';

@injectable()
export class BitbucketServerRepositoryProvider implements RepositoryProvider {

    async getRepo(user: User, owner: string, name: string): Promise<Repository> {
        // const api = await this.apiFactory.create(user);
        // const repo = (await api.repositories.get({ workspace: owner, repo_slug: name })).data;
        // let cloneUrl = repo.links!.clone!.find((x: any) => x.name === "https")!.href!;
        // if (cloneUrl) {
        //     const url = new URL(cloneUrl);
        //     url.username = '';
        //     cloneUrl = url.toString();
        // }
        // const host = RepoURL.parseRepoUrl(cloneUrl)!.host;
        // const description = repo.description;
        // const avatarUrl = repo.owner!.links!.avatar!.href;
        // const webUrl = repo.links!.html!.href;
        // const defaultBranch = repo.mainbranch?.name;
        // return { host, owner, name, cloneUrl, description, avatarUrl, webUrl, defaultBranch };
        throw new Error("getRepo unimplemented");
    }

    async getBranch(user: User, owner: string, repo: string, branchName: string): Promise<Branch> {
        // const api = await this.apiFactory.create(user);
        // const response = await api.repositories.getBranch({
        //     workspace: owner,
        //     repo_slug: repo,
        //     name: branchName
        // })

        // const branch = response.data;

        // return {
        //     htmlUrl: branch.links?.html?.href!,
        //     name: branch.name!,
        //     commit: {
        //         sha: branch.target?.hash!,
        //         author: branch.target?.author?.user?.display_name!,
        //         authorAvatarUrl: branch.target?.author?.user?.links?.avatar?.href,
        //         authorDate: branch.target?.date!,
        //         commitMessage: branch.target?.message || "missing commit message",
        //     }
        // };
        throw new Error("getBranch unimplemented");
    }

    async getBranches(user: User, owner: string, repo: string): Promise<Branch[]> {
        const branches: Branch[] = [];
        // const api = await this.apiFactory.create(user);
        // const response = await api.repositories.listBranches({
        //     workspace: owner,
        //     repo_slug: repo,
        //     sort: "target.date"
        // })

        // for (const branch of response.data.values!) {
        //     branches.push({
        //         htmlUrl: branch.links?.html?.href!,
        //         name: branch.name!,
        //         commit: {
        //             sha: branch.target?.hash!,
        //             author: branch.target?.author?.user?.display_name!,
        //             authorAvatarUrl: branch.target?.author?.user?.links?.avatar?.href,
        //             authorDate: branch.target?.date!,
        //             commitMessage: branch.target?.message || "missing commit message",
        //         }
        //     });
        // }

        return branches;
    }

    async getCommitInfo(user: User, owner: string, repo: string, ref: string): Promise<CommitInfo | undefined> {
        return undefined;
        // const api = await this.apiFactory.create(user);
        // const response = await api.commits.get({
        //     workspace: owner,
        //     repo_slug: repo,
        //     commit: ref
        // })
        // const commit = response.data;
        // return {
        //     sha: commit.hash!,
        //     author: commit.author?.user?.display_name!,
        //     authorDate: commit.date!,
        //     commitMessage: commit.message || "missing commit message",
        //     authorAvatarUrl: commit.author?.user?.links?.avatar?.href,
        // };
    }

    async getUserRepos(user: User): Promise<string[]> {
        // TODO(janx): Not implemented yet
        return [];
    }

    async hasReadAccess(user: User, owner: string, repo: string): Promise<boolean> {
        // TODO(janx): Not implemented yet
        return false;
    }

}
