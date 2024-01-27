/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import uuid = require("uuid");
import * as chai from "chai";
import { suite, test, timeout } from "@testdeck/mocha";
import { testContainer } from "../test-container";
import { CodeSyncResourceDB } from "./code-sync-resource-db";
import { IUserDataManifest, SyncResource } from "./entity/db-code-sync-resource";
import { resetDB } from "../test/reset-db";
import { TypeORM } from "./typeorm";
const expect = chai.expect;

@suite(timeout(10000))
export class CodeSyncResourceDBSpec {
    private readonly db = testContainer.get(CodeSyncResourceDB);

    private userId: string;

    before(): void {
        this.userId = uuid.v4();
    }

    async after(): Promise<void> {
        await resetDB(testContainer.get<TypeORM>(TypeORM));
    }

    @test()
    async insertResource(): Promise<void> {
        const doInsert = async () => {
            inserted = true;
        };

        const kind = "machines";
        let latest = await this.db.getResource(this.userId, kind, "latest", undefined);
        expect(latest).to.be.undefined;

        let inserted = false;
        let rev = await this.db.insert(this.userId, kind, undefined, "0", doInsert);
        expect(rev).not.to.be.undefined;
        expect(inserted).to.be.true;

        latest = await this.db.getResource(this.userId, kind, "latest", undefined);
        expect(latest?.rev).to.deep.equal(rev);

        const resource = await this.db.getResource(this.userId, kind, rev!, undefined);
        expect(resource).to.deep.equal(latest);

        inserted = false;
        rev = await this.db.insert(this.userId, kind, undefined, uuid.v4(), doInsert);
        expect(rev).to.be.undefined;
        expect(inserted).to.be.false;

        inserted = false;
        rev = await this.db.insert(this.userId, kind, undefined, latest?.rev, doInsert);
        expect(rev).not.to.be.undefined;
        expect(rev).not.to.eq(latest?.rev);
        expect(inserted).to.be.true;
    }

    @test()
    async getDeleteResources(): Promise<void> {
        const kind = "machines";
        let resources = await this.db.getResources(this.userId, kind, undefined);
        expect(resources).to.be.empty;

        const expected = [];
        for (let i = 0; i < 5; i++) {
            const rev = await this.db.insert(this.userId, kind, undefined, undefined, async () => {});
            expected.unshift(rev);
        }

        resources = await this.db.getResources(this.userId, kind, undefined);
        expect(resources.map((r) => r.rev)).to.deep.equal(expected);

        await this.db.deleteResource(this.userId, kind, expected[0], undefined, async () => {});
        await this.db.deleteResource(this.userId, kind, expected[1], undefined, async () => {});
        expected.shift();
        expected.shift();

        resources = await this.db.getResources(this.userId, kind, undefined);
        expect(resources.map((r) => r.rev)).to.deep.equal(expected);

        await this.db.deleteResource(this.userId, kind, undefined, undefined, async () => {});

        resources = await this.db.getResources(this.userId, kind, undefined);
        expect(resources).to.be.empty;
    }

    @test()
    async getManifest(): Promise<void> {
        let manifest = await this.db.getManifest(this.userId);
        expect(manifest).to.undefined;

        let machinesRev = await this.db.insert(this.userId, "machines", undefined, undefined, async () => {});
        manifest = await this.db.getManifest(this.userId);
        expect(manifest).to.deep.eq(<IUserDataManifest>{
            session: this.userId,
            latest: {
                machines: machinesRev,
            },
        });

        const extensionsRev = await this.db.insert(
            this.userId,
            SyncResource.Extensions,
            undefined,
            undefined,
            async () => {},
        );
        manifest = await this.db.getManifest(this.userId);
        expect(manifest).to.deep.eq(<IUserDataManifest>{
            session: this.userId,
            latest: {
                machines: machinesRev,
                extensions: extensionsRev,
            },
        });

        machinesRev = await this.db.insert(this.userId, "machines", undefined, undefined, async () => {});
        manifest = await this.db.getManifest(this.userId);
        expect(manifest).to.deep.eq(<IUserDataManifest>{
            session: this.userId,
            latest: {
                machines: machinesRev,
                extensions: extensionsRev,
            },
        });
    }

    @test()
    async roundRobinResourceInsert(): Promise<void> {
        const kind = "machines";
        const expectation: string[] = [];
        const doInsert = async (newRev: string, oldRevs?: string[]) => {
            expectation.unshift(newRev);

            if (!oldRevs) {
                return;
            }

            for (const rev of oldRevs) {
                await this.db.deleteResource(this.userId, kind, rev, undefined, async () => {});
            }
        };
        const revLimit = 3;

        const assertResources = async () => {
            const resources = await this.db.getResources(this.userId, kind, undefined);
            expect(resources.map((r) => r.rev)).to.deep.eq(expectation);
        };

        await assertResources();

        await this.db.insert(this.userId, kind, undefined, undefined, doInsert, { revLimit, overwrite: true });
        await this.db.insert(this.userId, kind, undefined, undefined, doInsert, { revLimit, overwrite: true });
        await this.db.insert(this.userId, kind, undefined, undefined, doInsert, { revLimit, overwrite: true });
        await assertResources();

        await this.db.insert(this.userId, kind, undefined, undefined, doInsert, { revLimit, overwrite: true });
        expectation.length = revLimit;
        await assertResources();

        await this.db.insert(this.userId, kind, undefined, undefined, doInsert, { revLimit, overwrite: true });
        await this.db.insert(this.userId, kind, undefined, undefined, doInsert, { revLimit, overwrite: true });
        expectation.length = revLimit;
        await assertResources();

        await this.db.insert(this.userId, kind, undefined, undefined, doInsert, { revLimit, overwrite: true });
        await this.db.insert(this.userId, kind, undefined, undefined, doInsert, { revLimit, overwrite: true });
        await this.db.insert(this.userId, kind, undefined, undefined, doInsert, { revLimit, overwrite: true });
        expectation.length = revLimit;
        await assertResources();
    }

    @test()
    async createDeleteCollection(): Promise<void> {
        const currentCollections1 = (await this.db.getCollections(this.userId)).map(({ id }) => id);
        expect(currentCollections1).to.be.empty;

        const collections: string[] = [];
        for (let i = 0; i < 5; i++) {
            collections.push(await this.db.createCollection(this.userId));
        }
        expect(collections.length).to.be.equal(5);

        const currentCollections2 = (await this.db.getCollections(this.userId)).map(({ id }) => id);
        expect(currentCollections2.sort()).to.deep.equal(collections.slice().sort());

        await this.db.deleteCollection(this.userId, collections[0], async () => {});
        await this.db.deleteCollection(this.userId, collections[1], async () => {});
        collections.shift();
        collections.shift();

        const currentCollections3 = (await this.db.getCollections(this.userId)).map(({ id }) => id);
        expect(currentCollections3.sort()).to.deep.equal(collections.slice().sort());

        await this.db.deleteCollection(this.userId, undefined, async () => {});

        const currentCollections4 = (await this.db.getCollections(this.userId)).map(({ id }) => id);
        expect(currentCollections4).to.be.empty;
    }

    @test()
    async insertCollectionResource(): Promise<void> {
        const doInsert = async () => {
            inserted = true;
        };

        const collection = await this.db.createCollection(this.userId);

        const kind = SyncResource.GlobalState;
        let latest = await this.db.getResource(this.userId, kind, "latest", collection);
        expect(latest).to.be.undefined;

        let inserted = false;
        let rev = await this.db.insert(this.userId, kind, collection, "0", doInsert);
        expect(rev).not.to.be.undefined;
        expect(inserted).to.be.true;

        latest = await this.db.getResource(this.userId, kind, "latest", collection);
        expect(latest?.rev).to.deep.equal(rev);

        const resource = await this.db.getResource(this.userId, kind, rev!, collection);
        expect(resource).to.deep.equal(latest);

        inserted = false;
        rev = await this.db.insert(this.userId, kind, collection, uuid.v4(), doInsert);
        expect(rev).to.be.undefined;
        expect(inserted).to.be.false;

        inserted = false;
        rev = await this.db.insert(this.userId, kind, collection, latest?.rev, doInsert);
        expect(rev).not.to.be.undefined;
        expect(rev).not.to.eq(latest?.rev);
        expect(inserted).to.be.true;
    }

    @test()
    async getDeleteCollectionResources(): Promise<void> {
        const collection = await this.db.createCollection(this.userId);

        const kind = SyncResource.GlobalState;
        let resources = await this.db.getResources(this.userId, kind, collection);
        expect(resources).to.be.empty;

        const expected = [];
        for (let i = 0; i < 5; i++) {
            const rev = await this.db.insert(this.userId, kind, collection, undefined, async () => {});
            expected.unshift(rev);
        }

        resources = await this.db.getResources(this.userId, kind, collection);
        expect(resources.map((r) => r.rev)).to.deep.equal(expected);

        await this.db.deleteResource(this.userId, kind, expected[0], collection, async () => {});
        await this.db.deleteResource(this.userId, kind, expected[1], collection, async () => {});
        expected.shift();
        expected.shift();

        resources = await this.db.getResources(this.userId, kind, collection);
        expect(resources.map((r) => r.rev)).to.deep.equal(expected);

        await this.db.deleteResource(this.userId, kind, undefined, collection, async () => {});

        resources = await this.db.getResources(this.userId, kind, collection);
        expect(resources).to.be.empty;

        const expected2 = [];
        for (let i = 0; i < 5; i++) {
            const rev = await this.db.insert(this.userId, kind, collection, undefined, async () => {});
            expected2.unshift(rev);
        }

        resources = await this.db.getResources(this.userId, kind, collection);
        expect(resources.map((r) => r.rev)).to.deep.equal(expected2);

        await this.db.deleteCollection(this.userId, collection, async () => {});

        resources = await this.db.getResources(this.userId, kind, collection);
        expect(resources).to.be.empty;
    }

    @test()
    async getCollectionManifest(): Promise<void> {
        let manifest = await this.db.getManifest(this.userId);
        expect(manifest).to.be.undefined;

        const collection1 = await this.db.createCollection(this.userId);

        let globalStateRev = await this.db.insert(
            this.userId,
            SyncResource.GlobalState,
            collection1,
            undefined,
            async () => {},
        );
        manifest = await this.db.getManifest(this.userId);
        expect(manifest).to.deep.eq(<IUserDataManifest>{
            session: this.userId,
            latest: {},
            collections: {
                [collection1]: {
                    latest: {
                        globalState: globalStateRev,
                    },
                },
            },
        });

        const extensionsRev = await this.db.insert(
            this.userId,
            SyncResource.Extensions,
            collection1,
            undefined,
            async () => {},
        );
        manifest = await this.db.getManifest(this.userId);
        expect(manifest).to.deep.eq(<IUserDataManifest>{
            session: this.userId,
            latest: {},
            collections: {
                [collection1]: {
                    latest: {
                        globalState: globalStateRev,
                        extensions: extensionsRev,
                    },
                },
            },
        });

        globalStateRev = await this.db.insert(
            this.userId,
            SyncResource.GlobalState,
            collection1,
            undefined,
            async () => {},
        );
        manifest = await this.db.getManifest(this.userId);
        expect(manifest).to.deep.eq(<IUserDataManifest>{
            session: this.userId,
            latest: {},
            collections: {
                [collection1]: {
                    latest: {
                        globalState: globalStateRev,
                        extensions: extensionsRev,
                    },
                },
            },
        });

        const collection2 = await this.db.createCollection(this.userId);

        const keybindingsRev = await this.db.insert(
            this.userId,
            SyncResource.Keybindings,
            collection2,
            undefined,
            async () => {},
        );
        manifest = await this.db.getManifest(this.userId);
        expect(manifest).to.deep.eq({
            session: this.userId,
            latest: {},
            collections: {
                [collection1]: {
                    latest: {
                        globalState: globalStateRev,
                        extensions: extensionsRev,
                    },
                },
                [collection2]: {
                    latest: {
                        keybindings: keybindingsRev,
                    },
                },
            },
        } as IUserDataManifest);
    }
}
