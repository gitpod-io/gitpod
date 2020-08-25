/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';

import { User, Repository } from "@gitpod/gitpod-protocol"
import { GitHubRestApi } from "./api";
import { RepositoryProvider } from '../repohost/repository-provider';
import { parseRepoUrl } from '../repohost/repo-url';

@injectable()
export class GithubRepositoryProvider implements RepositoryProvider {
    @inject(GitHubRestApi) protected readonly github: GitHubRestApi;

    async getRepo(user: User, owner: string, name: string): Promise<Repository> {
        const repository = await this.github.getRepository(user, { owner, repo: name });
        const cloneUrl = repository.clone_url;
        const host = parseRepoUrl(cloneUrl)!.host;
        const description = repository.description;
        const avatarUrl = repository.owner.avatar_url;
        const webUrl = repository.html_url;
        return { host, owner, name, cloneUrl, description, avatarUrl, webUrl };
    }
}
