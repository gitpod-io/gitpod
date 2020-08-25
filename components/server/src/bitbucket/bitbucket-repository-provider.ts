/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Repository, User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from 'inversify';
import { parseRepoUrl } from '../repohost/repo-url';
import { RepositoryProvider } from '../repohost/repository-provider';
import BitbucketApiFactory from './bitbucket-api-factory';

@injectable()
export class BitbucketRepositoryProvider implements RepositoryProvider {

    @inject(BitbucketApiFactory) protected readonly apiFactory: BitbucketApiFactory;

    async getRepo(user: User, owner: string, name: string): Promise<Repository> {
        const api = await this.apiFactory.create(user);
        const repo = (await api.repositories.get({ workspace: owner, repo_slug: name })).data;
        const cloneUrl = repo.links!.clone!.find((x: any) => x.name === "https")!.href!;
        const host = parseRepoUrl(cloneUrl)!.host;
        const description = repo.description;
        const avatarUrl = repo.owner!.links!.avatar!.href;
        const webUrl = repo.links!.html!.href;
        return { host, owner, name, cloneUrl, description, avatarUrl, webUrl };
    }
}
