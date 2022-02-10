/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';

import { User, Repository } from "@gitpod/gitpod-protocol"
import { Gitea, GiteaRestApi } from "./api";
import { LanguagesProvider } from '../repohost/languages-provider';

@injectable()
export class GiteaLanguagesProvider implements LanguagesProvider {

    @inject(GiteaRestApi) protected readonly gitea: GiteaRestApi;

    async getLanguages(repository: Repository, user: User): Promise<object> {
        const languages = await this.gitea.run<object>(user, (gitea) => gitea.repos.repoGetLanguages(repository.owner, repository.name ));

        if (Gitea.ApiError.is(languages)) {
            throw new Error(`Can\' get languages from repository ${repository.owner}/${repository.name}`);
        }

        return languages;
    }
}
