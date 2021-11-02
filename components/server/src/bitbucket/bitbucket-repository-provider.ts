/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Branch, CommitInfo, Repository, User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from 'inversify';
import { RepoURL } from '../repohost/repo-url';
import { RepositoryProvider } from '../repohost/repository-provider';
import { BitbucketApiFactory } from './bitbucket-api-factory';

@injectable()
export class BitbucketRepositoryProvider implements RepositoryProvider {

    @inject(BitbucketApiFactory) protected readonly apiFactory: BitbucketApiFactory;

    async getRepo(user: User, owner: string, name: string): Promise<Repository> {
        const api = await this.apiFactory.create(user);
        const repo = (await api.repositories.get({ workspace: owner, repo_slug: name })).data;
        const cloneUrl = repo.links!.clone!.find((x: any) => x.name === "https")!.href!;
        const host = RepoURL.parseRepoUrl(cloneUrl)!.host;
        const description = repo.description;
        const avatarUrl = repo.owner!.links!.avatar!.href;
        const webUrl = repo.links!.html!.href;
        return { host, owner, name, cloneUrl, description, avatarUrl, webUrl };
    }

    async getBranch(user: User, owner: string, repo: string, branch: string): Promise<Branch> {
        // todo
        throw new Error("not implemented");
    }

    async getBranches(user: User, owner: string, repo: string): Promise<Branch[]> {
        // todo
        return [];
    }

    async getCommitInfo(user: User, owner: string, repo: string, ref: string): Promise<CommitInfo | undefined> {
        // todo
        return undefined;
    }
}
