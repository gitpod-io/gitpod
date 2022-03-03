/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import uuid = require('uuid');
import * as chai from 'chai';
import { suite, test, timeout } from 'mocha-typescript';
import { testContainer } from '../test-container';
import { CodeSyncResourceDB } from './code-sync-resource-db';
import { IUserDataManifest, SyncResource } from './entity/db-code-sync-resource';
const expect = chai.expect;

@suite(timeout(10000))
export class CodeSyncResourceDBSpec {
    private readonly db = testContainer.get(CodeSyncResourceDB);

    private userId: string;

    before(): void {
        this.userId = uuid.v4();
    }

    async after(): Promise<void> {
        await this.db.delete(this.userId, () => Promise.resolve());
    }

    @test()
    async insert(): Promise<void> {
        const doInsert = async () => {
            inserted = true;
        };
        const kind = 'machines';
        let latest = await this.db.getResource(this.userId, kind, 'latest');
        expect(latest).to.be.undefined;

        let inserted = false;
        let rev = await this.db.insert(this.userId, kind, doInsert);
        expect(rev).not.to.be.undefined;
        expect(inserted).to.be.true;

        latest = await this.db.getResource(this.userId, kind, 'latest');
        expect(latest?.rev).to.deep.equal(rev);

        const resource = await this.db.getResource(this.userId, kind, rev!);
        expect(resource).to.deep.equal(latest);

        inserted = false;
        rev = await this.db.insert(this.userId, kind, doInsert, {
            latestRev: uuid.v4(),
        });
        expect(rev).to.be.undefined;
        expect(inserted).to.be.false;

        inserted = false;
        rev = await this.db.insert(this.userId, kind, doInsert, {
            latestRev: latest?.rev,
        });
        expect(rev).not.to.be.undefined;
        expect(rev).not.to.eq(latest?.rev);
        expect(inserted).to.be.true;
    }

    @test()
    async getResources(): Promise<void> {
        const kind = 'machines';
        let resources = await this.db.getResources(this.userId, kind);
        expect(resources).to.be.empty;

        const expected = [];
        for (let i = 0; i < 5; i++) {
            const rev = await this.db.insert(this.userId, kind, async () => {});
            expected.unshift(rev);
        }

        resources = await this.db.getResources(this.userId, kind);
        expect(resources.map((r) => r.rev)).to.deep.equal(expected);
    }

    @test()
    async getManifest(): Promise<void> {
        let manifest = await this.db.getManifest(this.userId);
        expect(manifest).to.deep.eq(<IUserDataManifest>{
            session: this.userId,
            latest: {},
        });

        let machinesRev = await this.db.insert(this.userId, 'machines', async () => {});
        manifest = await this.db.getManifest(this.userId);
        expect(manifest).to.deep.eq(<IUserDataManifest>{
            session: this.userId,
            latest: {
                machines: machinesRev,
            },
        });

        let extensionsRev = await this.db.insert(this.userId, SyncResource.Extensions, async () => {});
        manifest = await this.db.getManifest(this.userId);
        expect(manifest).to.deep.eq(<IUserDataManifest>{
            session: this.userId,
            latest: {
                machines: machinesRev,
                extensions: extensionsRev,
            },
        });

        machinesRev = await this.db.insert(this.userId, 'machines', async () => {});
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
    async roundRobinInsert(): Promise<void> {
        const kind = 'machines';
        const expectation: string[] = [];
        const doInsert = async () => {};
        const revLimit = 3;

        const assertResources = async () => {
            const resources = await this.db.getResources(this.userId, kind);
            expect(resources.map((r) => r.rev)).to.deep.eq(expectation);
        };

        await assertResources();

        expectation.unshift((await this.db.insert(this.userId, kind, doInsert, { revLimit }))!);
        expectation.unshift((await this.db.insert(this.userId, kind, doInsert, { revLimit }))!);
        expectation.unshift((await this.db.insert(this.userId, kind, doInsert, { revLimit }))!);
        await assertResources();

        expectation.unshift((await this.db.insert(this.userId, kind, doInsert, { revLimit }))!);
        expectation.length = revLimit;
        await assertResources();

        expectation.unshift((await this.db.insert(this.userId, kind, doInsert, { revLimit }))!);
        expectation.unshift((await this.db.insert(this.userId, kind, doInsert, { revLimit }))!);
        expectation.length = revLimit;
        await assertResources();

        expectation.unshift((await this.db.insert(this.userId, kind, doInsert, { revLimit }))!);
        expectation.unshift((await this.db.insert(this.userId, kind, doInsert, { revLimit }))!);
        expectation.unshift((await this.db.insert(this.userId, kind, doInsert, { revLimit }))!);
        expectation.length = revLimit;
        await assertResources();
    }
}
