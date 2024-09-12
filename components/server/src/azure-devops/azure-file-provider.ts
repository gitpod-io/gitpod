/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";

import { FileProvider, MaybeContent } from "../repohost/file-provider";
import { Commit, User, Repository } from "@gitpod/gitpod-protocol";
import { AzureDevOpsApi } from "./azure-api";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class AzureDevOpsFileProvider implements FileProvider {
    @inject(AzureDevOpsApi) protected readonly api: AzureDevOpsApi;

    public async getGitpodFileContent(commit: Commit, user: User): Promise<MaybeContent> {
        const yamlVersion1 = await Promise.all([
            this.api.getFileContent(user, commit, ".gitpod.yml"),
            this.api.getFileContent(user, commit, ".gitpod"),
        ]);
        return yamlVersion1.filter((f) => !!f)[0];
    }

    public async getLastChangeRevision(
        repository: Repository,
        revisionOrBranch: string,
        user: User,
        path: string,
    ): Promise<string> {
        const results = await Promise.allSettled([
            this.api.getCommits(user, repository.name, "test-project", {
                filterCommit: {
                    revision: revisionOrBranch,
                    refType: "revision",
                },
                $top: 1,
                itemPath: path,
            }),
            this.api.getCommits(user, repository.name, "test-project", {
                filterCommit: {
                    revision: "",
                    ref: revisionOrBranch,
                    refType: "tag",
                },
                $top: 1,
                itemPath: path,
            }),
            this.api.getCommits(user, repository.name, "test-project", {
                filterCommit: {
                    revision: "",
                    ref: revisionOrBranch,
                    refType: "branch",
                },
                $top: 1,
                itemPath: path,
            }),
        ]);
        for (const result of results) {
            if (result.status === "rejected") {
                continue;
            }
            if (result.value && result.value.length > 0 && result.value[0].commitId) {
                return result.value[0].commitId;
            }
        }
        // TODO(hw): [AZ] proper handle error
        throw new Error(`File ${path} does not exist in repository ${repository.owner}/${repository.name}`);
    }

    public async getFileContent(commit: Commit, user: User, path: string): Promise<MaybeContent> {
        try {
            const result = await this.api.getFileContent(user, commit, path);
            return result;
        } catch (error) {
            log.debug(error);
        }
    }
}
