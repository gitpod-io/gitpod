/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Commit, Repository, User } from '@gitpod/gitpod-protocol';
import { injectable } from 'inversify';
import { FileProvider, MaybeContent } from '../repohost/file-provider';

@injectable()
export class BitbucketServerFileProvider implements FileProvider {
    public async getGitpodFileContent(commit: Commit, user: User): Promise<MaybeContent> {
        return undefined;
        // const yamlVersion1 = await Promise.all([
        //     this.getFileContent(commit, user, '.gitpod.yml'),
        //     this.getFileContent(commit, user, '.gitpod')
        // ]);
        // return yamlVersion1.filter(f => !!f)[0];
    }

    public async getLastChangeRevision(
        repository: Repository,
        revisionOrBranch: string,
        user: User,
        path: string,
    ): Promise<string> {
        // try {
        //     const api = await this.apiFactory.create(user);
        //     const fileMetaData = (await api.repositories.readSrc({ workspace: repository.owner, repo_slug: repository.name, commit: revisionOrBranch, path, format: "meta" })).data;
        //     return (fileMetaData as any).commit.hash;
        // } catch (err) {
        //     log.error({ userId: user.id }, err);
        //     throw new Error(`Could not fetch ${path} of repository ${repository.owner}/${repository.name}: ${err}`);
        // }
        return 'f00';
    }

    public async getFileContent(commit: Commit, user: User, path: string) {
        return undefined;
        // if (!commit.revision) {
        //     return undefined;
        // }

        // try {
        //     const api = await this.apiFactory.create(user);
        //     const contents = (await api.repositories.readSrc({ workspace: commit.repository.owner, repo_slug: commit.repository.name, commit: commit.revision, path })).data;
        //     return contents as string;
        // } catch (err) {
        //     log.error({ userId: user.id }, err);
        // }
    }
}
