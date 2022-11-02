/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { suite, test, timeout } from "mocha-typescript";
import { testContainer } from "./test-container";
import { TypeORM } from "./typeorm/typeorm";
import {
    WorkspaceCluster,
    WorkspaceClusterDB,
    WorkspaceClusterWoTLS,
} from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { DBWorkspaceCluster } from "./typeorm/entity/db-workspace-cluster";
const expect = chai.expect;

@suite
@timeout(5000)
export class WorkspaceClusterDBSpec {
    typeORM = testContainer.get<TypeORM>(TypeORM);
    db = testContainer.get<WorkspaceClusterDB>(WorkspaceClusterDB);

    async before() {
        await this.clear();
    }

    async after() {
        await this.clear();
    }

    protected async clear() {
        const connection = await this.typeORM.getConnection();
        const manager = connection.manager;
        await manager.clear(DBWorkspaceCluster);
    }

    @test public async findByName() {
        const wsc1: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "eu71",
            applicationCluster: "eu02",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
        });
        const wsc1a: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "eu71",
            applicationCluster: "us02",
            url: "some-url",
            state: "cordoned",
            score: 0,
            maxScore: 0,
            govern: false,
        });
        const wsc2: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "us71",
            applicationCluster: "eu02",
            url: "some-url",
            state: "cordoned",
            score: 0,
            maxScore: 0,
            govern: false,
        });

        await this.db.save(wsc1);
        await this.db.save(wsc1a);
        await this.db.save(wsc2);

        // Can find the eu71 cluster as seen by the eu02 application cluster.
        const result = await this.db.findByName("eu71", "eu02");
        expect(result).not.to.be.undefined;
        expect((result as WorkspaceCluster).name).to.equal("eu71");
        expect((result as WorkspaceCluster).applicationCluster).to.equal("eu02");

        // Can find the eu71 cluster as seen by the us02 application cluster.
        const result2 = await this.db.findByName("eu71", "us02");
        expect(result2).not.to.be.undefined;
        expect((result2 as WorkspaceCluster).name).to.equal("eu71");
        expect((result2 as WorkspaceCluster).applicationCluster).to.equal("us02");

        // Can find the us71 cluster as seen by the eu02 application cluster.
        const result3 = await this.db.findByName("us71", "eu02");
        expect(result3).not.to.be.undefined;
        expect((result3 as WorkspaceCluster).name).to.equal("us71");
        expect((result3 as WorkspaceCluster).applicationCluster).to.equal("eu02");
    }

    @test public async deleteByName() {
        const wsc1: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "eu71",
            applicationCluster: "eu02",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
        });
        const wsc1a: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "eu71",
            applicationCluster: "us02",
            url: "some-url",
            state: "cordoned",
            score: 0,
            maxScore: 0,
            govern: false,
        });
        const wsc2: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "us71",
            applicationCluster: "eu02",
            url: "some-url",
            state: "cordoned",
            score: 0,
            maxScore: 0,
            govern: false,
        });

        await this.db.save(wsc1);
        await this.db.save(wsc1a);
        await this.db.save(wsc2);

        // Can delete the eu71 cluster as seen by the eu02 application cluster.
        await this.db.deleteByName("eu71", "eu02");
        expect(await this.db.findByName("eu71", "eu02")).to.be.undefined;
        expect(await this.db.findByName("eu71", "us02")).not.to.be.undefined;
        expect(await this.db.findByName("us71", "eu02")).not.to.be.undefined;
    }

    @test public async testFindFilteredByName() {
        const wsc1: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "eu71",
            applicationCluster: "eu02",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
        });
        const wsc1a: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "eu71",
            applicationCluster: "us02",
            url: "some-url",
            state: "cordoned",
            score: 0,
            maxScore: 0,
            govern: false,
        });
        const wsc2: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "us71",
            applicationCluster: "eu02",
            url: "some-url",
            state: "cordoned",
            score: 0,
            maxScore: 0,
            govern: false,
        });

        await this.db.save(wsc1);
        await this.db.save(wsc1a);
        await this.db.save(wsc2);

        const wscs = await this.db.findFiltered({ name: "eu71", applicationCluster: "eu02" });
        expect(wscs.length).to.equal(1);
        expect(wscs[0].name).to.equal("eu71");
        expect(wscs[0].applicationCluster).to.equal("eu02");
    }

    @test public async testFindFilteredByApplicationCluster() {
        const wsc1: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "eu71",
            applicationCluster: "eu02",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
        });
        const wsc1a: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "eu71",
            applicationCluster: "us02",
            url: "some-url",
            state: "cordoned",
            score: 0,
            maxScore: 0,
            govern: false,
        });
        const wsc2: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "us71",
            applicationCluster: "us02",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
        });

        await this.db.save(wsc1);
        await this.db.save(wsc1a);
        await this.db.save(wsc2);

        const expectedClusters: WorkspaceClusterWoTLS[] = [
            {
                name: "eu71",
                applicationCluster: "eu02",
                url: "some-url",
                state: "available",
                score: 100,
                maxScore: 100,
                govern: true,
                admissionConstraints: [],
            },
        ];
        const actualClusters = await this.db.findFiltered({ applicationCluster: "eu02" });
        expect(actualClusters.length).to.equal(1);
        expect(actualClusters).to.deep.include.members(expectedClusters);

        const expectedClusters2: WorkspaceClusterWoTLS[] = [
            {
                name: "eu71",
                applicationCluster: "us02",
                url: "some-url",
                state: "cordoned",
                score: 0,
                maxScore: 0,
                govern: false,
                admissionConstraints: [],
            },
            {
                name: "us71",
                applicationCluster: "us02",
                url: "some-url",
                state: "available",
                score: 100,
                maxScore: 100,
                govern: true,
                admissionConstraints: [],
            },
        ];
        const wscs2 = await this.db.findFiltered({ applicationCluster: "us02" });
        expect(wscs2.length).to.equal(2);
        expect(wscs2).to.deep.include.members(expectedClusters2);
    }

    @test public async testFindFilteredExcludesDeletedClusters() {
        const wsc1: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "eu71",
            applicationCluster: "eu02",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
        });
        const wsc1a: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "eu71",
            applicationCluster: "us02",
            url: "some-url",
            state: "cordoned",
            score: 0,
            maxScore: 0,
            govern: false,
        });
        const wsc2: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "us71",
            applicationCluster: "us02",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
        });

        await this.db.save(wsc1);
        await this.db.save(wsc1a);
        await this.db.save(wsc2);

        await this.db.deleteByName("eu71", "us02");

        let wscs = await this.db.findFiltered({ applicationCluster: "us02" });
        expect(wscs.length).to.equal(1);
        wscs = await this.db.findFiltered({ applicationCluster: "eu02" });
        expect(wscs.length).to.equal(1);
    }
}

function dbWorkspaceCluster(cluster: Omit<DBWorkspaceCluster, "deleted">): DBWorkspaceCluster {
    return { ...cluster, deleted: false };
}

module.exports = WorkspaceClusterDBSpec;
