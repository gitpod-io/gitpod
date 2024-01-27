/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { suite, test, timeout } from "@testdeck/mocha";
import { testContainer } from "./test-container";
import { TypeORM } from "./typeorm/typeorm";
import { WorkspaceCluster, WorkspaceClusterDB } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { DBWorkspaceCluster } from "./typeorm/entity/db-workspace-cluster";
import { resetDB } from "./test/reset-db";
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
        await resetDB(this.typeORM);
    }

    @test public async findByName() {
        const wsc1: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "eu71",
            region: "europe",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
        });
        const wsc2: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "us71",
            region: "europe",
            url: "some-url",
            state: "cordoned",
            score: 0,
            maxScore: 0,
            govern: false,
        });

        await this.db.save(wsc1);
        await this.db.save(wsc2);

        const result = await this.db.findByName("eu71");
        expect(result).not.to.be.undefined;
        expect((result as WorkspaceCluster).name).to.equal("eu71");

        // Can find the eu71 cluster as seen by the us02 application cluster.
        const result2 = await this.db.findByName("eu71");
        expect(result2).not.to.be.undefined;
        expect((result2 as WorkspaceCluster).name).to.equal("eu71");
    }

    @test public async deleteByName() {
        const wsc1: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "eu71",
            region: "europe",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
        });
        const wsc2: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "us71",
            region: "europe",
            url: "some-url",
            state: "cordoned",
            score: 0,
            maxScore: 0,
            govern: false,
        });

        await this.db.save(wsc1);
        await this.db.save(wsc2);

        await this.db.deleteByName("eu71");
        expect(await this.db.findByName("eu71")).to.be.undefined;
        expect(await this.db.findByName("us71")).not.to.be.undefined;
    }

    @test public async testFindFilteredByName() {
        const wsc1: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "eu71",
            region: "north-america",
            url: "some-url",
            state: "cordoned",
            score: 0,
            maxScore: 0,
            govern: false,
            availableWorkspaceClasses: [
                {
                    id: "some-class",
                    displayName: "Some Class",
                    description: "Some class description",
                    creditsPerMinute: 0.5,
                },
            ],
            preferredWorkspaceClass: "some-class",
        });
        const wsc2: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "us71",
            region: "europe",
            url: "some-url",
            state: "cordoned",
            score: 0,
            maxScore: 0,
            govern: false,
        });

        await this.db.save(wsc1);
        await this.db.save(wsc2);

        const wscs = await this.db.findFiltered({ name: "eu71" });
        expect(wscs.length).to.equal(1);
        expect(wscs[0].name).to.equal("eu71");
        expect(wscs[0].availableWorkspaceClasses).to.deep.equal([
            {
                id: "some-class",
                displayName: "Some Class",
                description: "Some class description",
                creditsPerMinute: 0.5,
            },
        ]);
    }

    @test public async testFindFilteredByApplicationCluster() {
        const wsc1: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "eu71",
            region: "europe",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
            admissionConstraints: [],
        });
        const wsc2: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "us71",
            region: "north-america",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
            admissionConstraints: [],
        });

        await this.db.save(wsc1);
        await this.db.save(wsc2);

        const wscs2 = await this.db.findFiltered({});
        expect(wscs2.length).to.equal(2);
    }

    @test public async testFindFilteredExcludesDeletedClusters() {
        const wsc1: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "eu71",
            region: "europe",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
        });
        const wsc2: DBWorkspaceCluster = dbWorkspaceCluster({
            name: "us71",
            region: "north-america",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
        });

        await this.db.save(wsc1);
        await this.db.save(wsc2);

        await this.db.deleteByName("eu71");

        const wscs = await this.db.findFiltered({});
        expect(wscs.length).to.equal(1);
    }

    @test public async testFindFilteredWithRegion() {
        const clusters: DBWorkspaceCluster[] = [
            dbWorkspaceCluster({
                name: "eu71",
                region: "europe",
                url: "some-url",
                state: "available",
                score: 100,
                maxScore: 100,
                govern: true,
            }),
            dbWorkspaceCluster({
                name: "eu72",
                region: "",
                url: "some-url",
                state: "cordoned",
                score: 0,
                maxScore: 0,
                govern: false,
            }),
            dbWorkspaceCluster({
                name: "us71",
                region: "",
                url: "some-url",
                state: "available",
                score: 100,
                maxScore: 100,
                govern: true,
            }),
        ];

        for (const cluster of clusters) {
            await this.db.save(cluster);
        }

        const withoutRegionFilter = await this.db.findFiltered({});
        expect(withoutRegionFilter.length).to.equal(3);

        const matchingEurope = await this.db.findFiltered({ region: "europe" });
        expect(matchingEurope.length).to.equal(1);
    }
}

function dbWorkspaceCluster(cluster: Omit<DBWorkspaceCluster, "deleted">): DBWorkspaceCluster {
    return { ...cluster, deleted: false };
}

module.exports = WorkspaceClusterDBSpec;
