/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DBWorkspaceInstance, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { Job } from "./runner";
import { Config } from "../config";
import { GIT_STATUS_LENGTH_CAP_BYTES } from "../workspace/workspace-service";
import { Repository } from "typeorm";
import { WorkspaceInstance, WorkspaceInstanceRepoStatus } from "@gitpod/gitpod-protocol";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";

@injectable()
export class CapGitStatus implements Job {
    @inject(Config) protected readonly config: Config;
    @inject(WorkspaceDB) protected readonly workspaceDb: WorkspaceDB;

    public name = "git-status-capper";
    public frequencyMs = 2 * 60 * 1000; // every 2 minutes

    public async run(): Promise<number | undefined> {
        log.info("git-status: we're leading the quorum.");

        const validateGitStatusLength = await getExperimentsClientForBackend().getValueAsync(
            "api_validate_git_status_length",
            false,
            {},
        );
        if (!validateGitStatusLength) {
            log.info("git-status: feature flag is not enabled.");
            return;
        }

        const limit = 100;
        const instancesCapped = await this.workspaceDb.transaction(async (db) => {
            const repo = await ((db as any).getWorkspaceInstanceRepo() as Promise<Repository<DBWorkspaceInstance>>);
            const instances = await this.findInstancesWithLengthyGitStatus(repo, GIT_STATUS_LENGTH_CAP_BYTES, limit);
            if (instances.length === 0) {
                return 0;
            }

            // Cap the git status (incl. status.repo, the old place where we stored it before)
            instances.forEach((i) => {
                if (i.gitStatus) {
                    i.gitStatus = capGitStatus(i.gitStatus);
                }
                if (i.status) {
                    delete (i.status as any).repo;
                }
            });

            // In order to effectively cap the storage size, we have to delete and re-inser the instance.
            // Thank you, MySQL! -.-
            await repo.delete(instances.map((i) => i.id));
            await repo.save(instances);

            return instances.length;
        });

        log.info(`git-status: capped ${instancesCapped} instances.`);
        return instancesCapped;
    }

    async findInstancesWithLengthyGitStatus(
        repo: Repository<DBWorkspaceInstance>,
        byteLimit: number,
        limit: number = 1000,
    ): Promise<WorkspaceInstance[]> {
        const qb = repo
            .createQueryBuilder("wsi")
            .where("JSON_STORAGE_SIZE(wsi.gitStatus) > :byteLimit", { byteLimit })
            .orWhere("JSON_STORAGE_SIZE(wsi.status) > :byteLimit", { byteLimit })
            .limit(limit);
        return qb.getMany();
    }
}

function capGitStatus(gitStatus: WorkspaceInstanceRepoStatus): WorkspaceInstanceRepoStatus {
    const MARGIN = 800; // to account for attribute name's, and generic JSON overhead
    const maxLength = GIT_STATUS_LENGTH_CAP_BYTES - MARGIN;
    let bytesUsed = 0;
    function capStr(str: string | undefined): string | undefined {
        if (str === undefined) {
            return undefined;
        }

        const len = Buffer.byteLength(str, "utf8") + 6;
        if (bytesUsed + len > maxLength) {
            return undefined;
        }
        bytesUsed = bytesUsed + len;
        return str;
    }
    function filterStr(str: string | undefined): boolean {
        return !!capStr(str);
    }

    gitStatus.branch = capStr(gitStatus.branch);
    gitStatus.latestCommit = capStr(gitStatus.latestCommit);
    gitStatus.uncommitedFiles = gitStatus.uncommitedFiles?.filter(filterStr);
    gitStatus.untrackedFiles = gitStatus.untrackedFiles?.filter(filterStr);
    gitStatus.unpushedCommits = gitStatus.unpushedCommits?.filter(filterStr);

    return gitStatus;
}
