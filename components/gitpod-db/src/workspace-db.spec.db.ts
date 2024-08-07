/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
const expect = chai.expect;
import { suite, test, timeout } from "@testdeck/mocha";
import { fail } from "assert";

import { WorkspaceInstance, Workspace, PrebuiltWorkspace, CommitContext } from "@gitpod/gitpod-protocol";
import { testContainer } from "./test-container";
import { TypeORMWorkspaceDBImpl } from "./typeorm/workspace-db-impl";
import { TypeORM } from "./typeorm/typeorm";
import { DBPrebuiltWorkspace } from "./typeorm/entity/db-prebuilt-workspace";
import { secondsBefore } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { resetDB } from "./test/reset-db";
import { v4 } from "uuid";

@suite
class WorkspaceDBSpec {
    db = testContainer.get<TypeORMWorkspaceDBImpl>(TypeORMWorkspaceDBImpl);
    typeorm = testContainer.get<TypeORM>(TypeORM);

    readonly timeWs = new Date(2018, 2, 16, 10, 0, 0).toISOString();
    readonly timeBefore = new Date(2018, 2, 16, 11, 5, 10).toISOString();
    readonly timeAfter = new Date(2019, 2, 16, 11, 5, 10).toISOString();
    readonly userId = "12345";
    readonly projectAID = "projectA";
    readonly projectBID = "projectB";
    readonly orgidA = "orgA";
    readonly orgidB = "orgB";
    readonly ws: Workspace = {
        id: "1",
        type: "regular",
        creationTime: this.timeWs,
        config: {
            ports: [],
            image: "",
            tasks: [],
        },
        projectId: this.projectAID,
        context: <CommitContext>{
            title: "example",
            repository: {
                cloneUrl: "https://github.com/gitpod-io/gitpod",
            },
            revision: "abc",
        },
        contextURL: "example.org",
        description: "blabla",
        ownerId: this.userId,
        organizationId: this.orgidA,
    };
    readonly wsi1: WorkspaceInstance = {
        workspaceId: this.ws.id,
        id: "123",
        ideUrl: "example.org",
        region: "unknown",
        workspaceClass: undefined,
        workspaceImage: "abc.io/test/image:123",
        creationTime: this.timeBefore,
        startedTime: undefined,
        deployedTime: undefined,
        stoppingTime: undefined,
        stoppedTime: undefined,
        status: {
            version: 1,
            phase: "preparing",
            conditions: {},
        },
        configuration: {
            theiaVersion: "unknown",
            ideImage: "unknown",
        },
        deleted: false,
        usageAttributionId: undefined,
    };
    readonly wsi2: WorkspaceInstance = {
        workspaceId: this.ws.id,
        id: "1234",
        ideUrl: "example.org",
        region: "unknown",
        workspaceClass: undefined,
        workspaceImage: "abc.io/test/image:123",
        creationTime: this.timeAfter,
        startedTime: undefined,
        deployedTime: undefined,
        stoppingTime: undefined,
        stoppedTime: undefined,
        status: {
            version: 1,
            phase: "running",
            conditions: {},
        },
        configuration: {
            theiaVersion: "unknown",
            ideImage: "unknown",
        },
        deleted: false,
        usageAttributionId: undefined,
    };
    readonly ws2: Workspace = {
        id: "2",
        type: "regular",
        creationTime: this.timeWs,
        config: {
            ports: [],
            image: "",
            tasks: [],
        },
        projectId: this.projectBID,
        context: <CommitContext>{
            title: "example",
            repository: {
                cloneUrl: "https://github.com/gitpod-io/gitpod",
            },
            revision: "abc",
        },
        contextURL: "https://github.com/gitpod-io/gitpod",
        description: "Gitpod",
        ownerId: this.userId,
        organizationId: this.orgidA,
    };
    readonly ws2i1: WorkspaceInstance = {
        workspaceId: this.ws2.id,
        id: "4",
        ideUrl: "example.org",
        region: "unknown",
        workspaceClass: undefined,
        workspaceImage: "abc.io/test/image:123",
        creationTime: this.timeBefore,
        startedTime: undefined,
        deployedTime: undefined,
        stoppingTime: undefined,
        stoppedTime: undefined,
        status: {
            version: 1,
            phase: "preparing",
            conditions: {},
        },
        configuration: {
            theiaVersion: "unknown",
            ideImage: "unknown",
        },
        deleted: false,
        usageAttributionId: undefined,
    };

    readonly ws3: Workspace = {
        id: "3",
        type: "regular",
        creationTime: this.timeWs,
        config: {
            ports: [],
            image: "",
            tasks: [],
        },
        context: <CommitContext>{
            title: "example",
            repository: {
                cloneUrl: "https://github.com/gitpod-io/gitpod",
            },
            revision: "abc",
        },
        contextURL: "example.org",
        description: "blabla",
        ownerId: this.userId,
        organizationId: this.orgidB,
    };
    readonly ws3i1: WorkspaceInstance = {
        workspaceId: this.ws3.id,
        id: "3_1",
        ideUrl: "example.org",
        region: "unknown",
        workspaceClass: undefined,
        workspaceImage: "abc.io/test/image:123",
        creationTime: this.timeBefore,
        startedTime: undefined,
        deployedTime: undefined,
        stoppingTime: undefined,
        stoppedTime: undefined,
        status: {
            version: 1,
            phase: "preparing",
            conditions: {},
        },
        configuration: {
            theiaVersion: "unknown",
            ideImage: "unknown",
        },
        deleted: false,
        usageAttributionId: undefined,
    };

    async before() {
        await this.wipeRepo();
    }

    async after() {
        await this.wipeRepo();
    }

    async wipeRepo() {
        await resetDB(this.typeorm);
    }

    @test(timeout(10000))
    public async testFindInstancesLast() {
        try {
            await this.db.transaction(async (db) => {
                await Promise.all([db.store(this.ws), db.storeInstance(this.wsi1), db.storeInstance(this.wsi2)]);
                const dbResult = await db.findInstances(this.ws.id);
                expect(dbResult).to.have.deep.members([this.wsi1, this.wsi2]);
                throw "rollback";
            });
        } catch (e) {
            if (e !== "rollback") throw e;
            const dbResult = await this.db.findInstances(this.ws.id);
            expect(dbResult).to.not.have.deep.members([this.wsi1, this.wsi2]);
            return;
        }
        fail("Rollback failed");
    }

    @test(timeout(10000))
    public async testFindByInstanceId() {
        await this.db.transaction(async (db) => {
            await Promise.all([db.store(this.ws), db.storeInstance(this.wsi1)]);
            const dbResult = await db.findByInstanceId(this.wsi1.id);
            const expected = await db.findById(this.wsi1.workspaceId);
            expect(dbResult).to.deep.eq(expected);
        });
    }

    @test(timeout(10000))
    public async testFindEligableWorkspacesForSoftDeletion_markedEligable_Prebuild() {
        const { ws } = await this.createPrebuild(20, 15);
        const dbResult = await this.db.findEligibleWorkspacesForSoftDeletion(new Date(), 10, "prebuild");
        expect(dbResult.length).to.equal(1);
        expect(dbResult[0].id).to.eq(ws.id);
        expect(dbResult[0].ownerId).to.eq(ws.ownerId);
    }

    @test(timeout(10000))
    public async testFindEligableWorkspacesForSoftDeletion_notMarkedEligable_Prebuild() {
        await this.createPrebuild(20, -7);
        const dbResult = await this.db.findEligibleWorkspacesForSoftDeletion(new Date(), 10, "prebuild");
        expect(dbResult.length).to.eq(0);
    }

    @test(timeout(10000))
    public async testPrebuildGarbageCollection() {
        const { pbws } = await this.createPrebuild(20, 15);

        // mimick the behavior of the Garbage Collector
        const gcWorkspaces = await this.db.findEligibleWorkspacesForSoftDeletion(new Date(), 10, "prebuild");
        expect(gcWorkspaces.length).to.equal(1);

        const now = new Date().toISOString();
        await this.db.updatePartial(gcWorkspaces[0].id, {
            contentDeletedTime: now,
            softDeletedTime: now,
            softDeleted: "gc",
        });

        // next cycle is empty
        const nextGcCycle = await this.db.findEligibleWorkspacesForSoftDeletion(new Date(), 10, "prebuild");
        expect(nextGcCycle.length).to.equal(0);

        // prebuild can't be discovered anymore because it's workspace has been GC'ed
        const prebuild = await this.db.findPrebuildByID(pbws.id);
        expect(prebuild).to.be.undefined;
    }

    protected async createPrebuild(createdDaysAgo: number, deletionEligibilityTimeDaysAgo?: number) {
        const now = new Date();
        now.setDate(now.getDate() - createdDaysAgo);
        const creationTime = now.toISOString();
        const ws = await this.db.store({
            id: "12345",
            creationTime,
            description: "something",
            contextURL: "https://github.com/foo/bar",
            ownerId: "1221423",
            organizationId: "org123",
            context: {
                title: "my title",
            },
            config: {},
            type: "prebuild",
        });
        const pbws = await this.db.storePrebuiltWorkspace({
            id: "prebuild123",
            buildWorkspaceId: "12345",
            creationTime,
            cloneURL: "https://github.com/foo/bar",
            commit: "",
            state: "available",
            statusVersion: 0,
        });

        if (deletionEligibilityTimeDaysAgo !== undefined) {
            const deletionEligibilityTime = new Date();
            deletionEligibilityTime.setDate(deletionEligibilityTime.getDate() - deletionEligibilityTimeDaysAgo);
            await this.db.updatePartial(ws.id, { deletionEligibilityTime: deletionEligibilityTime.toISOString() });
        }

        return { ws, pbws };
    }

    @test(timeout(10000))
    public async testFindEligableWorkspacesForSoftDeletion_markedEligable() {
        this.ws.deletionEligibilityTime = this.timeWs;
        await Promise.all([this.db.store(this.ws), this.db.storeInstance(this.wsi1), this.db.storeInstance(this.wsi2)]);
        const dbResult = await this.db.findEligibleWorkspacesForSoftDeletion(new Date(this.timeAfter), 10);
        expect(dbResult[0].id).to.eq(this.ws.id);
        expect(dbResult[0].ownerId).to.eq(this.ws.ownerId);
    }

    @test(timeout(10000))
    public async testFindEligableWorkspacesForSoftDeletion_notMarkedEligable() {
        await Promise.all([this.db.store(this.ws), this.db.storeInstance(this.wsi1), this.db.storeInstance(this.wsi2)]);
        const dbResult = await this.db.findEligibleWorkspacesForSoftDeletion(new Date(this.timeAfter), 10);
        expect(dbResult.length).to.eq(0);
    }

    @test(timeout(10000))
    public async testFindAllWorkspaceAndInstances_workspaceId() {
        await Promise.all([
            this.db.store(this.ws),
            this.db.storeInstance(this.wsi1),
            this.db.store(this.ws2),
            this.db.storeInstance(this.ws2i1),
        ]);
        const dbResult = await this.db.findAllWorkspaceAndInstances(0, 10, "workspaceId", "DESC", {
            workspaceId: this.ws2.id,
        });
        // It should only find one workspace instance
        expect(dbResult.total).to.eq(1);

        // It should find the workspace with the queried id
        const workspaceAndInstance = dbResult.rows[0];
        expect(workspaceAndInstance.workspaceId).to.eq(this.ws2.id);
    }

    @test(timeout(10000))
    public async testFindAllWorkspaceAndInstances_workspaceIdOrInstanceId() {
        await Promise.all([
            this.db.store(this.ws),
            this.db.storeInstance(this.wsi1),
            this.db.store(this.ws2),
            this.db.storeInstance(this.ws2i1),
        ]);
        const dbResult = await this.db.findAllWorkspaceAndInstances(0, 10, "workspaceId", "DESC", {
            instanceIdOrWorkspaceId: this.ws2.id,
        });
        // It should only find one workspace instance
        expect(dbResult.total).to.eq(1);

        // It should find the workspace with the queried id
        const workspaceAndInstance = dbResult.rows[0];
        expect(workspaceAndInstance.workspaceId).to.eq(this.ws2.id);
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
        const dbResult = await this.db.findAllWorkspaceAndInstances(0, 10, "instanceId", "DESC", {
            instanceId: this.wsi1.id,
        });

        // It should only find one workspace instance
        expect(dbResult.total).to.eq(1);

        // It should find the workspace with the queried id
        const workspaceAndInstance = dbResult.rows[0];
        expect(workspaceAndInstance.workspaceId).to.eq(this.ws.id);

        // It should select the workspace instance that was queried, not the most recent one
        expect(workspaceAndInstance.instanceId).to.eq(this.wsi1.id);
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
            includeWithoutProject: false,
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
            includeWithoutProject: false,
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
            includeWithoutProject: false,
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
            includeWithoutProject: false,
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
            includeWithoutProject: true,
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
            includeWithoutProject: true,
        });

        expect(dbResult.length).to.eq(2);

        expect(dbResult[0].workspace.id).to.eq(this.ws2.id);
        expect(dbResult[1].workspace.id).to.eq(this.ws3.id);
    }

    @test(timeout(10000))
    public async testCountUnabortedPrebuildsSince() {
        const now = new Date();
        const cloneURL = "https://github.com/gitpod-io/gitpod";
        const projectId = v4();

        await Promise.all([
            // Created now, and queued
            this.storePrebuiltWorkspace({
                id: "prebuild123",
                buildWorkspaceId: "apples",
                creationTime: now.toISOString(),
                cloneURL: cloneURL,
                projectId,
                commit: "",
                state: "queued",
                statusVersion: 0,
            }),
            // now and aborted
            this.storePrebuiltWorkspace({
                id: "prebuild456",
                buildWorkspaceId: "bananas",
                creationTime: now.toISOString(),
                cloneURL: cloneURL,
                projectId,
                commit: "",
                state: "aborted",
                statusVersion: 0,
            }),
            // completed over a minute ago
            this.storePrebuiltWorkspace({
                id: "prebuild789",
                buildWorkspaceId: "oranges",
                creationTime: secondsBefore(now.toISOString(), 62),
                cloneURL: cloneURL,
                projectId,
                commit: "",
                state: "available",
                statusVersion: 0,
            }),
            // different project now and queued
            this.storePrebuiltWorkspace({
                id: "prebuild123-other",
                buildWorkspaceId: "apples",
                creationTime: now.toISOString(),
                cloneURL: cloneURL,
                projectId: "other-projectId",
                commit: "",
                state: "queued",
                statusVersion: 0,
            }),
        ]);

        const minuteAgo = secondsBefore(now.toISOString(), 60);
        const unabortedCount = await this.db.countUnabortedPrebuildsSince(projectId, new Date(minuteAgo));
        expect(unabortedCount).to.eq(1);
    }

    @test(timeout(10000))
    public async testGetWorkspaceCountForCloneURL() {
        const now = new Date();
        const eightDaysAgo = new Date();
        eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
        const activeRepo = "http://github.com/myorg/active.git";
        const inactiveRepo = "http://github.com/myorg/inactive.git";
        await Promise.all([
            this.db.store({
                id: "12345",
                creationTime: eightDaysAgo.toISOString(),
                description: "something",
                contextURL: "http://github.com/myorg/inactive",
                ownerId: "1221423",
                organizationId: "org123",
                context: <CommitContext>{
                    title: "my title",
                    repository: {
                        cloneUrl: inactiveRepo,
                    },
                    revision: "abc",
                },
                config: {},
                type: "regular",
            }),
            this.db.store({
                id: "12346",
                creationTime: now.toISOString(),
                description: "something",
                contextURL: "http://github.com/myorg/active",
                ownerId: "1221423",
                organizationId: "org123",
                context: <CommitContext>{
                    title: "my title",
                    repository: {
                        cloneUrl: activeRepo,
                    },
                    revision: "abc",
                },
                config: {},
                type: "regular",
            }),
        ]);

        const inactiveCount = await this.db.getWorkspaceCountByCloneURL(inactiveRepo, 7, "regular");
        expect(inactiveCount).to.eq(0, "there should be no regular workspaces in the past 7 days");
        const activeCount = await this.db.getWorkspaceCountByCloneURL(activeRepo, 7, "regular");
        expect(activeCount).to.eq(1, "there should be exactly one regular workspace");
    }

    @test(timeout(10000))
    public async testGetUnresolvedUpdatables() {
        {
            // setup ws, wsi, pws, and updatables
            const timeWithOffset = (offsetInHours: number) => {
                const date = new Date();
                date.setHours(date.getHours() - offsetInHours);
                return date;
            };

            for (let i = 1; i <= 10; i++) {
                const ws = await this.db.store({
                    ...this.ws,
                    id: `ws-${i}`,
                    creationTime: timeWithOffset(i).toISOString(),
                });
                const pws = await this.db.storePrebuiltWorkspace({
                    buildWorkspaceId: ws.id,
                    cloneURL: ws.cloneUrl!,
                    commit: "abc",
                    creationTime: ws.creationTime,
                    id: ws.id + "-pws",
                    state: "queued",
                    statusVersion: 123,
                });
                await this.db.storeInstance({
                    ...this.wsi1,
                    workspaceId: ws.id,
                    id: ws.id + "-wsi",
                });
                await this.db.attachUpdatableToPrebuild("pwsid-which-is-ignored-anyways", {
                    id: `pwu-${i}`,
                    installationId: "foobar",
                    isResolved: false,
                    owner: "owner",
                    repo: "repo",
                    prebuiltWorkspaceId: pws.id,
                });
            }
        }

        expect((await this.db.getUnresolvedUpdatables()).length).to.eq(10, "there should be 10 updatables in total");
        expect((await this.db.getUnresolvedUpdatables(5)).length).to.eq(5, "there should be 5 updatables");
    }

    private async storePrebuiltWorkspace(pws: PrebuiltWorkspace) {
        // store the creationTime directly, before it is modified by the store function in the ORM layer
        const creationTime = pws.creationTime;
        await this.db.storePrebuiltWorkspace(pws);

        const conn = await this.typeorm.getConnection();
        const repo = conn.getRepository(DBPrebuiltWorkspace);

        if (!!creationTime) {
            // MySQL requires the time format to be 2022-03-07 15:44:01.746141
            // Looks almost like an ISO time string, hack it a bit.
            const mysqlTimeFormat = creationTime.replace("T", " ").replace("Z", "");
            await repo.query("UPDATE d_b_prebuilt_workspace SET creationTime = ? WHERE id = ?", [
                mysqlTimeFormat,
                pws.id,
            ]);
        }
    }

    @test(timeout(10000))
    public async findWorkspacesForPurging() {
        const creationTime = "2018-01-01T00:00:00.000Z";
        const ownerId = "1221423";
        const organizationId = "org123";
        const purgeDate = new Date("2019-02-01T00:00:00.000Z");
        const d20180202 = "2018-02-02T00:00:00.000Z";
        const d20180201 = "2018-02-01T00:00:00.000Z";
        const d20180131 = "2018-01-31T00:00:00.000Z";
        await Promise.all([
            this.db.store({
                id: "1",
                creationTime,
                description: "something",
                contextURL: "http://github.com/myorg/inactive",
                ownerId,
                organizationId,
                context: {
                    title: "my title",
                },
                config: {},
                type: "regular",
                contentDeletedTime: d20180131,
            }),
            this.db.store({
                id: "2",
                creationTime,
                description: "something",
                contextURL: "http://github.com/myorg/active",
                ownerId,
                organizationId,
                context: {
                    title: "my title",
                },
                config: {},
                type: "regular",
                contentDeletedTime: d20180201,
            }),
            this.db.store({
                id: "3",
                creationTime,
                description: "something",
                contextURL: "http://github.com/myorg/active",
                ownerId,
                organizationId,
                context: {
                    title: "my title",
                },
                config: {},
                type: "regular",
                contentDeletedTime: d20180202,
            }),
            this.db.store({
                id: "4",
                creationTime,
                description: "something",
                contextURL: "http://github.com/myorg/active",
                ownerId,
                organizationId,
                context: {
                    title: "my title",
                },
                config: {},
                type: "regular",
                contentDeletedTime: undefined,
            }),
        ]);

        const wsIds = await this.db.findWorkspacesForPurging(365, 1000, purgeDate);
        expect(wsIds).to.deep.equal([
            {
                id: "1",
                ownerId,
            },
        ]);
    }

    @test(timeout(10000))
    public async findWorkspacesByOrganizationId() {
        await this.db.store(this.ws);
        await this.db.store(this.ws2);
        await this.db.store(this.ws3);
        let result = await this.db.find({
            userId: this.userId,
            organizationId: this.orgidA,
        });

        expect(result.length).to.eq(2);
        for (const ws of result) {
            expect(ws.workspace.organizationId).to.equal(this.orgidA);
        }

        result = await this.db.find({
            userId: this.userId,
            organizationId: this.orgidB,
        });

        expect(result.length).to.eq(1);
        for (const ws of result) {
            expect(ws.workspace.organizationId).to.equal(this.orgidB);
        }

        result = await this.db.find({
            userId: this.userId,
            organizationId: "no-org",
        });

        expect(result.length).to.eq(0);
    }

    @test(timeout(10000))
    public async hardDeleteWorkspace() {
        await this.db.store(this.ws);
        await this.db.storeInstance(this.wsi1);
        await this.db.storeInstance(this.wsi2);
        let result = await this.db.findInstances(this.ws.id);
        expect(result.length).to.eq(2);
        await this.db.hardDeleteWorkspace(this.ws.id);
        result = await this.db.findInstances(this.ws.id);
        expect(result.length).to.eq(0);
    }

    @test()
    public async storeAndUpdateGitStatus() {
        const inst = {
            ...this.wsi1,
            gitstatus: undefined,
        };

        await this.db.storeInstance(inst);
        let result = await this.db.findInstances(inst.workspaceId);
        expect(!result[0].gitStatus).to.be.true;

        inst.gitStatus = {
            branch: "my/branch",
        };
        await this.db.storeInstance(inst);

        result = await this.db.findInstances(inst.workspaceId);
        expect(result[0].gitStatus?.branch).to.eq("my/branch");
    }
}
module.exports = new WorkspaceDBSpec();
