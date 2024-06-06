/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
const expect = chai.expect;
import { suite, test, timeout } from "@testdeck/mocha";

import { WorkspaceInstance, WorkspaceInstanceRepoStatus } from "@gitpod/gitpod-protocol";
import { DBWorkspaceInstance, TypeORM, WorkspaceDB, resetDB } from "@gitpod/gitpod-db/lib";
import { Repository } from "typeorm";
import { CapGitStatus } from "./cap-git-status";
import { createTestContainer } from "../test/service-testing-container-module";
import { Container } from "inversify";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";

const workspaceId = "ws123";

@suite
class CapGitStatusTest {
    container: Container;
    db: WorkspaceDB;

    async before() {
        this.container = createTestContainer();
        Experiments.configureTestingClient({
            api_validate_git_status_length: true,
        });
        await this.wipeRepos();

        this.db = this.container.get<WorkspaceDB>(WorkspaceDB);
    }

    async after() {
        // await this.wipeRepos();
    }

    async wipeRepos() {
        const typeorm = this.container.get<TypeORM>(TypeORM);
        await resetDB(typeorm);
    }

    instance(nr: number) {
        const gitStatus: WorkspaceInstanceRepoStatus = {
            branch: "main",
            latestCommit: "abc",
            untrackedFiles: [],
        };
        for (let i = 0; i < 100; i++) {
            gitStatus.untrackedFiles?.push(`file_${i}_${"a".repeat(100)}`);
        }
        gitStatus.totalUntrackedFiles = gitStatus.untrackedFiles?.length;

        const instance: WorkspaceInstance = {
            id: `wsi${nr}`,
            workspaceId,
            creationTime: new Date(2018, 2, 16, 10, 0, 0).toISOString(),
            ideUrl: "lalalal",
            region: "somewhere",
            workspaceImage: "eu.gcr.io/gitpod-io/workspace-images@sha256:123",
            configuration: {
                ideImage: "eu.gcr.io/gitpod-io/ide@sha256:123",
            },
            status: {
                phase: "stopped",
                conditions: {},
                version: 1,
            },
            gitStatus,
        };
        return instance;
    }

    @test(timeout(10000))
    public async createUserAndFindById() {
        await this.db.storeInstance(this.instance(1));

        const job = this.container.get<CapGitStatus>(CapGitStatus);
        expect(await findInstancesWithLengthyGitStatus(job, this.db), "instances with lengthy git status").to.equal(1);
        expect(await job.run(), "number of capped instances").to.equal(1);
        expect(await findInstancesWithLengthyGitStatus(job, this.db), "instances with lengthy git status").to.equal(0);
    }
}

async function findInstancesWithLengthyGitStatus(job: CapGitStatus, db: WorkspaceDB): Promise<number> {
    const repo = await ((db as any).getWorkspaceInstanceRepo() as Promise<Repository<DBWorkspaceInstance>>);
    const instances = await job.findInstancesWithLengthyGitStatus(repo, 4096, 100);
    return instances.length;
}

module.exports = new CapGitStatusTest();
