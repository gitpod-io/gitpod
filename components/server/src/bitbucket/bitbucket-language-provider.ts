/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Repository, User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from 'inversify';
import { LanguagesProvider } from '../repohost/languages-provider';
import { BitbucketApiFactory } from './bitbucket-api-factory';
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class BitbucketLanguagesProvider implements LanguagesProvider {

    @inject(BitbucketApiFactory) protected readonly apiFactory: BitbucketApiFactory;

    async getLanguages(repository: Repository, user: User): Promise<object> {
        try {
            const api = await this.apiFactory.create(user);
            const repo = await api.repositories.get({ workspace: repository.owner, repo_slug: repository.name });
            const language = repo.data.language;
            if (language) {
                return { [language]: 100.0 };
            }
        } catch (e) {
            log.warn({ userId: user.id }, "Could not get languages of Bitbucket repo.");
        }
        return {};
    }
}
