/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as chai from 'chai';
const expect = chai.expect;
import { suite, test, timeout } from 'mocha-typescript';

import { WorkspaceInstance, Workspace } from '@gitpod/gitpod-protocol';
import { testContainer } from './test-container';
import { TypeORMWorkspaceDBImpl } from './typeorm/workspace-db-impl';
import { fail } from 'assert';
import { TypeORM } from './typeorm/typeorm';
import { DBWorkspace } from './typeorm/entity/db-workspace';
import { DBPrebuiltWorkspace } from './typeorm/entity/db-prebuilt-workspace';
import { DBWorkspaceInstance } from './typeorm/entity/db-workspace-instance';

@suite class WorkspaceDBSpec {

    db = testContainer.get<TypeORMWorkspaceDBImpl>(TypeORMWorkspaceDBImpl);
    typeorm = testContainer.get<TypeORM>(TypeORM);

    readonly timeWs = new Date(2018, 2, 16, 10, 0, 0).toISOString();
    readonly timeBefore = new Date(2018, 2, 16, 11, 5, 10).toISOString();
    readonly timeAfter = new Date(2019, 2, 16, 11, 5, 10).toISOString();
    readonly userId = '12345';
    readonly projectAID = 'projectA';
    readonly projectBID = 'projectB';
    readonly ws: Workspace = {
        id: '1',
        type: 'regular',
        creationTime: this.timeWs,
        config: {
            ports: [],
            image: '',
            tasks: []
        },
        projectId: this.projectAID,
        context: { title: 'example' },
        contextURL: 'example.org',
        description: 'blabla',
        ownerId: this.userId
    };
    readonly wsi1: WorkspaceInstance = {
        workspaceId: this.ws.id,
        id: '123',
        ideUrl: 'example.org',
        region: 'unknown',
        workspaceImage: 'abc.io/test/image:123',
        creationTime: this.timeBefore,
        startedTime: undefined,
        deployedTime: undefined,
        stoppingTime: undefined,
        stoppedTime: undefined,
        status: {
            phase: "preparing",
            conditions: {},
        },
        configuration: {
            theiaVersion: "unknown",
            ideImage: "unknown"
        },
        deleted: false
    };
    readonly wsi2: WorkspaceInstance = {
        workspaceId: this.ws.id,
        id: '1234',
        ideUrl: 'example.org',
        region: 'unknown',
        workspaceImage: 'abc.io/test/image:123',
        creationTime: this.timeAfter,
        startedTime: undefined,
        deployedTime: undefined,
        stoppingTime: undefined,
        stoppedTime: undefined,
        status: {
            phase: "running",
            conditions: {},
        },
        configuration: {
            theiaVersion: "unknown",
            ideImage: "unknown"
        },
        deleted: false
    };
    readonly ws2: Workspace = {
        id: '2',
        type: 'regular',
        creationTime: this.timeWs,
        config: {
            ports: [],
            image: '',
            tasks: []
        },
        projectId: this.projectBID,
        context: { title: 'example' },
        contextURL: 'https://github.com/gitpod-io/gitpod',
        description: 'Gitpod',
        ownerId: this.userId
    };
    readonly ws2i1: WorkspaceInstance = {
        workspaceId: this.ws2.id,
        id: '4',
        ideUrl: 'example.org',
        region: 'unknown',
        workspaceImage: 'abc.io/test/image:123',
        creationTime: this.timeBefore,
        startedTime: undefined,
        deployedTime: undefined,
        stoppingTime: undefined,
        stoppedTime: undefined,
        status: {
            phase: "preparing",
            conditions: {},
        },
        configuration: {
            theiaVersion: "unknown",
            ideImage: "unknown"
        },
        deleted: false
    };

    readonly ws3: Workspace = {
        id: '3',
        type: 'regular',
        creationTime: this.timeWs,
        config: {
            ports: [],
            image: '',
            tasks: []
        },
        context: { title: 'example' },
        contextURL: 'example.org',
        description: 'blabla',
        ownerId: this.userId
    };
    readonly ws3i1: WorkspaceInstance = {
        workspaceId: this.ws3.id,
        id: '3_1',
        ideUrl: 'example.org',
        region: 'unknown',
        workspaceImage: 'abc.io/test/image:123',
        creationTime: this.timeBefore,
        startedTime: undefined,
        deployedTime: undefined,
        stoppingTime: undefined,
        stoppedTime: undefined,
        status: {
            phase: "preparing",
            conditions: {},
        },
        configuration: {
            theiaVersion: "unknown",
            ideImage: "unknown"
        },
        deleted: false
    };

    async before() {
        await this.wipeRepo();
    }

    async after() {
        await this.wipeRepo();
    }

    async wipeRepo() {
        const mnr = await (this.typeorm.getConnection());
        await mnr.getRepository(DBWorkspace).delete({});
        await mnr.getRepository(DBWorkspaceInstance).delete({});
        await mnr.getRepository(DBPrebuiltWorkspace).delete({});
    }

    @test(timeout(10000))
    public async testFindInstancesLast() {
        try {
            await this.db.transaction(async db => {
                await Promise.all([
                    db.store(this.ws),
                    db.storeInstance(this.wsi1),
                    db.storeInstance(this.wsi2)
                ]);
                const dbResult = await db.findInstances(this.ws.id);
                expect(dbResult).to.have.deep.members([this.wsi1, this.wsi2]);
                throw 'rollback';
            })
        } catch (e) {
            if (e !== 'rollback')
                throw e;
            const dbResult = await this.db.findInstances(this.ws.id);
            expect(dbResult).to.not.have.deep.members([this.wsi1, this.wsi2]);
            return;
        }
        fail('Rollback failed')
    }

    @test(timeout(10000))
    public async testFindPrebuildsForGC_oldPrebuildNoUsage() {
        await this.createPrebuild(2);
        const dbResult = await this.db.findPrebuiltWorkspacesForGC(1, 10);
        expect(dbResult.length).to.eq(1);
        expect(dbResult[0].id).to.eq('12345');
        expect(dbResult[0].ownerId).to.eq('1221423');
    }

    @test(timeout(10000))
    public async testFindPrebuildsForGC_newPrebuildNoUsage() {
        await this.createPrebuild(0);
        const dbResult = await this.db.findPrebuiltWorkspacesForGC(1, 10);
        expect(dbResult.length).to.eq(0);
    }

    @test(timeout(10000))
    public async testFindPrebuildsForGC_oldPrebuildOldUsage() {
        await this.createPrebuild(2, 2);
        const dbResult = await this.db.findPrebuiltWorkspacesForGC(1, 10);
        expect(dbResult.length).to.eq(1);
        expect(dbResult[0].id).to.eq('12345');
        expect(dbResult[0].ownerId).to.eq('1221423');
    }

    @test(timeout(10000))
    public async testFindPrebuildsForGC_oldPrebuildNewUsage() {
        await this.createPrebuild(12, 0);
        const dbResult = await this.db.findPrebuiltWorkspacesForGC(1, 10);
        expect(dbResult.length).to.eq(0);
    }

    protected async createPrebuild(createdDaysAgo: number, usageDaysAgo?: number) {
        const now = new Date();
        now.setDate(now.getDate() - createdDaysAgo);
        const creationTime = now.toISOString();
        await this.db.store({
            id: '12345',
            creationTime,
            description: 'something',
            contextURL: 'https://github.com/foo/bar',
            ownerId: '1221423',
            context: {
                title: 'my title'
            },
            config: {},
            type: 'prebuild'
        });
        await this.db.storePrebuiltWorkspace({
            id: 'prebuild123',
            buildWorkspaceId: '12345',
            creationTime,
            cloneURL: '',
            commit: '',
            state: 'available'
        });
        if (usageDaysAgo !== undefined) {
            const now = new Date();
            now.setDate(now.getDate() - usageDaysAgo);
            await this.db.store({
                id: 'usage-of-12345',
                creationTime: now.toISOString(),
                description: 'something',
                contextURL: 'https://github.com/foo/bar',
                ownerId: '1221423',
                context: {
                    title: 'my title'
                },
                config: {},
                basedOnPrebuildId: 'prebuild123',
                type: 'regular'
            });
        }
    }

    @test(timeout(10000))
    public async testFindWorkspacesForGarbageCollection() {
        await Promise.all([
            this.db.store(this.ws),
            this.db.storeInstance(this.wsi1),
            this.db.storeInstance(this.wsi2)
        ]);
        const dbResult = await this.db.findWorkspacesForGarbageCollection(14, 10);
        expect(dbResult[0].id).to.eq(this.ws.id);
        expect(dbResult[0].ownerId).to.eq(this.ws.ownerId);
    }

    @test(timeout(10000))
    public async testFindWorkspacesForGarbageCollection_no_instance() {
        await Promise.all([
            this.db.store(this.ws)
        ]);
        const dbResult = await this.db.findWorkspacesForGarbageCollection(14, 10);
        expect(dbResult[0].id).to.eq(this.ws.id);
        expect(dbResult[0].ownerId).to.eq(this.ws.ownerId);
    }

    @test(timeout(10000))
    public async testFindWorkspacesForGarbageCollection_latelyUsed() {
        this.wsi2.creationTime = new Date().toISOString();
        await Promise.all([
            this.db.store(this.ws),
            this.db.storeInstance(this.wsi1),
            this.db.storeInstance(this.wsi2)
        ]);
        const dbResult = await this.db.findWorkspacesForGarbageCollection(14, 10);
        expect(dbResult.length).to.eq(0);
    }

    @test(timeout(10000))
    public async testFindAllWorkspaces_contextUrl() {
        await Promise.all([
            this.db.store(this.ws)
        ]);
        const dbResult = await this.db.findAllWorkspaces(0, 10, "contextURL", "DESC", undefined, this.ws.contextURL);
        expect(dbResult.total).to.eq(1);
    }

    @test(timeout(10000))
    public async testFindAllWorkspaceAndInstances_contextUrl() {
        await Promise.all([
            this.db.store(this.ws),
            this.db.storeInstance(this.wsi1),
            this.db.storeInstance(this.wsi2),
            this.db.store(this.ws2),
            this.db.storeInstance(this.ws2i1),
        ]);
        const dbResult = await this.db.findAllWorkspaceAndInstances(0, 10, "contextURL", "DESC", undefined, this.ws.contextURL);
        // It should only find one workspace instance
        expect(dbResult.total).to.eq(1);

        const workspaceAndInstance = dbResult.rows[0]

        // It should find the workspace that uses the queried context url
        expect(workspaceAndInstance.workspaceId).to.eq(this.ws.id)

        // It should select the workspace instance that was most recently created
        expect(workspaceAndInstance.instanceId).to.eq(this.wsi2.id)
    }

    @test(timeout(10000))
    public async testFindAllWorkspaceAndInstances_workspaceId() {
        await Promise.all([
            this.db.store(this.ws),
            this.db.storeInstance(this.wsi1),
            this.db.store(this.ws2),
            this.db.storeInstance(this.ws2i1),
        ]);
        const dbResult = await this.db.findAllWorkspaceAndInstances(0, 10, "workspaceId", "DESC", { workspaceId: this.ws2.id }, undefined);
        // It should only find one workspace instance
        expect(dbResult.total).to.eq(1);

        // It should find the workspace with the queried id
        const workspaceAndInstance = dbResult.rows[0]
        expect(workspaceAndInstance.workspaceId).to.eq(this.ws2.id)
    }

    @test(timeout(10000))
    public async testFindAllWorkspaceAndInstances_workspaceIdOrInstanceId() {
        await Promise.all([
            this.db.store(this.ws),
            this.db.storeInstance(this.wsi1),
            this.db.store(this.ws2),
            this.db.storeInstance(this.ws2i1),
        ]);
        const dbResult = await this.db.findAllWorkspaceAndInstances(0, 10, "workspaceId", "DESC", { instanceIdOrWorkspaceId: this.ws2.id }, undefined);
        // It should only find one workspace instance
        expect(dbResult.total).to.eq(1);

        // It should find the workspace with the queried id
        const workspaceAndInstance = dbResult.rows[0]
        expect(workspaceAndInstance.workspaceId).to.eq(this.ws2.id)
    }

    @test(timeout(10000))
    public async testFindAllWorkspaceAndInstances_instanceId() {
        await Promise.all([
            this.db.store(this.ws),
            this.db.storeInstance(this.wsi1),
            this.db.storeInstance(this.wsi2),
            this.db.store(this.ws2),
            this.db.storeInstance(this.ws2i1),
        ]);
        const dbResult = await this.db.findAllWorkspaceAndInstances(0, 10, "instanceId", "DESC", { instanceId: this.wsi1.id }, undefined);

        // It should only find one workspace instance
        expect(dbResult.total).to.eq(1);

        // It should find the workspace with the queried id
        const workspaceAndInstance = dbResult.rows[0]
        expect(workspaceAndInstance.workspaceId).to.eq(this.ws.id)

        // It should select the workspace instance that was queried, not the most recent one
        expect(workspaceAndInstance.instanceId).to.eq(this.wsi1.id)
    }

    @test(timeout(10000))
    public async testFind_ByProjectIds() {
        await Promise.all([
            this.db.store(this.ws),
            this.db.storeInstance(this.wsi1),
            this.db.storeInstance(this.wsi2),
            this.db.store(this.ws2),
            this.db.storeInstance(this.ws2i1),
        ]);
        const dbResult = await this.db.find({
            userId: this.userId,
            includeHeadless: false,
            projectId: [this.projectAID],
            includeWithoutProject: false
        });

        // It should only find one workspace instance
        expect(dbResult.length).to.eq(1);

        expect(dbResult[0].workspace.id).to.eq(this.ws.id);
    }

    @test(timeout(10000))
    public async testFind_ByProjectIds_01() {
        await Promise.all([
            this.db.store(this.ws),
            this.db.storeInstance(this.wsi1),
            this.db.storeInstance(this.wsi2),
            this.db.store(this.ws2),
            this.db.storeInstance(this.ws2i1),
        ]);
        const dbResult = await this.db.find({
            userId: this.userId,
            includeHeadless: false,
            projectId: [this.projectBID],
            includeWithoutProject: false
        });

        // It should only find one workspace instance
        expect(dbResult.length).to.eq(1);

        expect(dbResult[0].workspace.id).to.eq(this.ws2.id);
    }

    @test(timeout(10000))
    public async testFind_ByProjectIds_02() {
        await Promise.all([
            this.db.store(this.ws),
            this.db.storeInstance(this.wsi1),
            this.db.storeInstance(this.wsi2),
            this.db.store(this.ws2),
            this.db.storeInstance(this.ws2i1),
        ]);
        const dbResult = await this.db.find({
            userId: this.userId,
            includeHeadless: false,
            projectId: [this.projectAID, this.projectBID],
            includeWithoutProject: false
        });

        expect(dbResult.length).to.eq(2);

        expect(dbResult[0].workspace.id).to.eq(this.ws.id);
        expect(dbResult[1].workspace.id).to.eq(this.ws2.id);
    }

    @test(timeout(10000))
    public async testFind_ByProjectIds_03() {
        await Promise.all([
            this.db.store(this.ws),
            this.db.storeInstance(this.wsi1),
            this.db.storeInstance(this.wsi2),
            this.db.store(this.ws2),
            this.db.storeInstance(this.ws2i1),
        ]);
        const dbResult = await this.db.find({
            userId: this.userId,
            includeHeadless: false,
            projectId: [],
            includeWithoutProject: false
        });

        expect(dbResult.length).to.eq(0);

        // expect(dbResult[0].workspace.id).to.eq(this.ws.id);
        // expect(dbResult[1].workspace.id).to.eq(this.ws2.id);
    }

    @test(timeout(10000))
    public async testFind_ByProjectIds_04() {
        await Promise.all([
            this.db.store(this.ws),
            this.db.storeInstance(this.wsi1),
            this.db.storeInstance(this.wsi2),
            this.db.store(this.ws2),
            this.db.storeInstance(this.ws2i1),
            this.db.store(this.ws3),
            this.db.storeInstance(this.ws3i1),
        ]);
        const dbResult = await this.db.find({
            userId: this.userId,
            includeHeadless: false,
            projectId: [],
            includeWithoutProject: true
        });

        expect(dbResult.length).to.eq(1);

        expect(dbResult[0].workspace.id).to.eq(this.ws3.id);
    }

    @test(timeout(10000))
    public async testFind_ByProjectIds_05() {
        await Promise.all([
            this.db.store(this.ws),
            this.db.storeInstance(this.wsi1),
            this.db.storeInstance(this.wsi2),
            this.db.store(this.ws2),
            this.db.storeInstance(this.ws2i1),
            this.db.store(this.ws3),
            this.db.storeInstance(this.ws3i1),
        ]);
        const dbResult = await this.db.find({
            userId: this.userId,
            includeHeadless: false,
            projectId: [this.projectBID],
            includeWithoutProject: true
        });

        expect(dbResult.length).to.eq(2);

        expect(dbResult[0].workspace.id).to.eq(this.ws2.id);
        expect(dbResult[1].workspace.id).to.eq(this.ws3.id);
    }
}
module.exports = new WorkspaceDBSpec()
