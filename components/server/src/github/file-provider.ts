/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";

import { FileProvider, MaybeContent } from "../repohost/file-provider";
import { Commit, User, Repository } from "@gitpod/gitpod-protocol";
import { GitHubGraphQlEndpoint, GitHubRestApi } from "./api";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class GithubFileProvider implements FileProvider {
    @inject(GitHubGraphQlEndpoint) protected readonly githubGraphQlApi: GitHubGraphQlEndpoint;
    @inject(GitHubRestApi) protected readonly githubApi: GitHubRestApi;

    public async getGitpodFileContent(commit: Commit, user: User): Promise<MaybeContent> {
        try {
            const content = await this.getFileContent(commit, user, ".devcontainer/.devcontainer.json");
            log.info({}, `Loaded content: ${content}`);
            // TODO: Translate
            return `
image:
  file: .gitpod.Dockerfile
  context: .

# List the ports you want to expose and what to do when they are served. See https://www.gitpod.io/docs/config-ports/
ports:
- port: 3000
  onOpen: open-preview

# List the start up tasks. You can start them in parallel in multiple terminals. See https://www.gitpod.io/docs/config-start-tasks/
tasks:
- command: |
    mongod
- init: |
    npm install
    npm run build
  command: |
    npm run start
vscode:
  extensions:
    - dbaeumer.vscode-eslint
`;
        } catch (e) {
            // TODO: LOG something
            log.error({}, e.message);
        }

        const yamlVersion1 = await Promise.all([
            this.getFileContent(commit, user, ".gitpod.yml"),
            this.getFileContent(commit, user, ".gitpod"),
        ]);
        return yamlVersion1.filter((f) => !!f)[0];
    }

    public async getLastChangeRevision(
        repository: Repository,
        revisionOrBranch: string,
        user: User,
        path: string,
    ): Promise<string> {
        const commits = (
            await this.githubApi.run(user, (gh) =>
                gh.repos.listCommits({
                    owner: repository.owner,
                    repo: repository.name,
                    sha: revisionOrBranch,
                    // per_page: 1, // we need just the last one right?
                    path,
                }),
            )
        ).data;

        const lastCommit = commits && commits[0];
        if (!lastCommit) {
            throw new Error(`File ${path} does not exist in repository ${repository.owner}/${repository.name}`);
        }

        return lastCommit.sha;
    }

    public async getFileContent(commit: Commit, user: User, path: string) {
        if (!commit.revision) {
            return undefined;
        }

        try {
            const contents = await this.githubGraphQlApi.getFileContents(
                user,
                commit.repository.owner,
                commit.repository.name,
                commit.revision,
                path,
            );
            return contents;
        } catch (err) {
            log.error(err);
        }
    }
}
