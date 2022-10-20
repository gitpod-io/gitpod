/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { suite, test, timeout } from "mocha-typescript";
import { testContainer } from "./test-container";
import { TypeORM } from "./typeorm/typeorm";
import { WorkspaceClusterDB } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
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

    @test public async testFindFilteredByName() {
        const wsc1: DBWorkspaceCluster = {
            name: "eu71",
            applicationCluster: "eu02",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
        };
        const wsc2: DBWorkspaceCluster = {
            name: "us71",
            applicationCluster: "eu02",
            url: "some-url",
            state: "cordoned",
            score: 0,
            maxScore: 0,
            govern: false,
        };

        await this.db.save(wsc1);
        await this.db.save(wsc2);

        const wscs = await this.db.findFiltered({ name: "eu71" });
        expect(wscs.length).to.equal(1);
        expect(wscs[0].name).to.equal("eu71");
    }

    @test public async testFindFilteredByApplicationCluster() {
        const wsc1: DBWorkspaceCluster = {
            name: "eu71",
            applicationCluster: "eu02",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
        };
        const wsc2: DBWorkspaceCluster = {
            name: "us71",
            applicationCluster: "us02",
            url: "some-url",
            state: "available",
            score: 100,
            maxScore: 100,
            govern: true,
        };

        await this.db.save(wsc1);
        await this.db.save(wsc2);

        const wscs = await this.db.findFiltered({ applicationCluster: "eu02" });
        expect(wscs.length).to.equal(1);
        expect(wscs[0].name).to.equal("eu71");
    }
}

module.exports = WorkspaceClusterDBSpec;
