/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';

import { User, Repository } from '@gitpod/gitpod-protocol';
import { GitHubRestApi } from './api';
import { LanguagesProvider } from '../repohost/languages-provider';

@injectable()
export class GithubLanguagesProvider implements LanguagesProvider {
  @inject(GitHubRestApi) protected readonly github: GitHubRestApi;

  async getLanguages(repository: Repository, user: User): Promise<object> {
    const languages = await this.github.run<object>(user, (gh) =>
      gh.repos.listLanguages({ owner: repository.owner, repo: repository.name }),
    );

    return languages.data;
  }
}
