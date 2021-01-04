/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';

import { User, Repository } from "@gitpod/gitpod-protocol"
import { GitLabApi, GitLab } from "./api";
import { LanguagesProvider } from '../repohost/languages-provider';

@injectable()
export class GitlabLanguagesProvider implements LanguagesProvider {

    @inject(GitLabApi) protected readonly gitlab: GitLabApi;

    async getLanguages(repository: Repository, user: User): Promise<object> {
        const languages = await this.gitlab.run<GitLab.Branch>(user, async g => {
            return g.Projects.languages(`${repository.owner}/${repository.name}`);
        });
        return languages;
    }
}
