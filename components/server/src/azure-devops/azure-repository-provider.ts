/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";

import { User, Repository, Branch, CommitInfo, RepositoryInfo } from "@gitpod/gitpod-protocol";
import { AzureDevOpsApi } from "./azure-api";
import { RepositoryProvider } from "../repohost/repository-provider";

import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { toBranch, toCommit, toRepository } from "./azure-converter";
import { AuthProviderParams } from "../auth/auth-provider";

@injectable()
export class AzureDevOpsRepositoryProvider implements RepositoryProvider {
    @inject(AuthProviderParams) readonly config: AuthProviderParams;
    @inject(AzureDevOpsApi) protected readonly azureDevOpsApi: AzureDevOpsApi;

    async getRepo(user: User, owner: string, name: string): Promise<Repository> {
        const resp = await this.azureDevOpsApi.getRepository(user, owner, name);
        return toRepository(this.config.host, resp);
    }

    async getBranch(user: User, owner: string, repo: string, branch: string): Promise<Branch> {
        const response = await this.azureDevOpsApi.getBranch(user, owner, repo, branch);
        const item = toBranch(response);
        if (!item) {
            // TODO(hw): [AZ]
            throw new Error("Failed to fetch commit.");
        }
        return item;
    }

    async getBranches(user: User, owner: string, repo: string): Promise<Branch[]> {
        const branches: Branch[] = [];
        const response = await this.azureDevOpsApi.getBranches(user, owner, repo);
        for (const b of response) {
            const item = toBranch(b);
            if (!item) {
                continue;
            }
            branches.push(item);
        }
        return branches;
    }

    async getCommitInfo(user: User, owner: string, repo: string, ref: string): Promise<CommitInfo | undefined> {
        const response = await this.azureDevOpsApi.getCommit(user, owner, repo, ref);
        return toCommit(response);
    }

    async getUserRepos(user: User): Promise<RepositoryInfo[]> {
        // FIXME(janx): Not implemented yet
        return [];
    }

    async hasReadAccess(user: User, owner: string, repo: string): Promise<boolean> {
        try {
            const response = await this.azureDevOpsApi.getRepository(user, owner, repo);
            return !!response.id;
        } catch (err) {
            log.warn({ userId: user.id }, "hasReadAccess error", err, { owner, repo });
            return false;
        }
    }

    public async getCommitHistory(
        user: User,
        owner: string,
        repo: string,
        revision: string,
        maxDepth: number = 100,
    ): Promise<string[]> {
        const result = await this.azureDevOpsApi.getCommits(user, repo, owner, {
            filterCommit: revision ? { revision, refType: "revision" } : undefined,
            $top: maxDepth,
        });
        return result
            .slice(1)
            .map((c) => c.commitId)
            .filter((c) => !!c) as string[];
    }

    public async searchRepos(user: User, searchString: string, limit: number): Promise<RepositoryInfo[]> {
        // Not supported yet, see ENT-780
        return [];
    }
}
