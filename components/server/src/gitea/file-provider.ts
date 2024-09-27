/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';

import { FileProvider, MaybeContent } from "../repohost/file-provider";
import { Commit, User, Repository } from "@gitpod/gitpod-protocol"
import { Gitea, GiteaRestApi } from "./api";

@injectable()
export class GiteaFileProvider implements FileProvider {

    @inject(GiteaRestApi) protected readonly giteaApi: GiteaRestApi;

    public async getGitpodFileContent(commit: Commit, user: User): Promise<MaybeContent> {
        const yamlVersion1 = await Promise.all([
            this.getFileContent(commit, user, '.gitpod.yml'),
            this.getFileContent(commit, user, '.gitpod')
        ]);
        return yamlVersion1.filter(f => !!f)[0];
    }

    public async getLastChangeRevision(repository: Repository, revisionOrBranch: string, user: User, path: string): Promise<string> {
        const commits = (await this.giteaApi.run<Gitea.Commit[]>(user, (api) => api.repos.repoGetAllCommits(repository.owner, repository.name, {
            sha: revisionOrBranch,
            limit: 1, // we need just the last one right?
            path
        })));

        if (Gitea.ApiError.is(commits) || commits.length === 0) {
            throw new Error(`File ${path} does not exist in repository ${repository.owner}/${repository.name}`);
        }

        const sha = commits[0].sha;
        if (!sha) {
            throw new Error(`File ${path} in repository ${repository.owner}/${repository.name} has no char. Is it a folder?`);
        }

        return sha;
    }

    public async getFileContent(commit: Commit, user: User, path: string): Promise<MaybeContent> {
        if (!commit.revision) {
            return undefined;
        }

        const contents = await this.giteaApi.run<string>(user, api => api.repos.repoGetRawFile(commit.repository.owner, commit.repository.name, path, { ref: commit.revision }))
        if (Gitea.ApiError.is(contents)) {
            return undefined; // e.g. 404 error, because the file isn't found
        }

        return contents;
    }
}
