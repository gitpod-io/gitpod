/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test, timeout } from "mocha-typescript";
import { testContainer } from "./test-container";
import { TypeORM } from "./typeorm/typeorm";
import { AuthProviderEntryDB } from ".";
import { DBAuthProviderEntry } from "./typeorm/entity/db-auth-provider-entry";
import { DeepPartial } from "@gitpod/gitpod-protocol/lib/util/deep-partial";
import * as chai from "chai";
const expect = chai.expect;

@suite(timeout(10000))
export class AuthProviderEntryDBSpec {
    private readonly db = testContainer.get<AuthProviderEntryDB>(AuthProviderEntryDB);

    // TODO(gpl) Since the upgrade to ts-node 10.4.0 establishing the inital connection takes up to 25s
    @timeout(30000)
    async before() {
        await this.clear();
    }

    async after() {
        await this.clear();
    }

    async clear() {
        const typeorm = testContainer.get<TypeORM>(TypeORM);
        const manager = await typeorm.getConnection();
        console.log("before delete");
        await manager.getRepository(DBAuthProviderEntry).delete({});
        console.log("after delete");
    }

    protected authProvider(ap: DeepPartial<DBAuthProviderEntry> = {}): DBAuthProviderEntry {
        const ownerId = "1234";
        const host = "github.com";
        return {
            id: "0049b9d2-005f-43c2-a0ae-76377805d8b8",
            host,
            ownerId,
            organizationId: null!,
            status: "verified",
            type: "GitHub",
            oauthRevision: undefined,
            deleted: false,
            ...ap,
            oauth: {
                callBackUrl: "example.org/some/callback",
                authorizationUrl: "example.org/some/auth",
                settingsUrl: "example.org/settings",
                clientId: "clientId",
                clientSecret: "clientSecret",
                tokenUrl: "example.org/get/token",
                scope: "scope",
                scopeSeparator: ",",
                ...ap.oauth,
                authorizationParams: {},
            },
        };
    }

    @test() public async testFindAll() {
        console.log("start findAll");
        const ap1 = this.authProvider({ id: "1", oauthRevision: "rev1" });
        const ap2 = this.authProvider({ id: "2", oauthRevision: "rev2" });
        await this.db.storeAuthProvider(ap1, false);
        await this.db.storeAuthProvider(ap2, false);

        const all = await this.db.findAll();
        expect(all, "findAll([])").to.deep.equal([ap1, ap2]);
        expect(await this.db.findAll([ap1.oauthRevision!, ap2.oauthRevision!]), "findAll([ap1, ap2])").to.be.empty;
        expect(await this.db.findAll([ap1.oauthRevision!]), "findAll([ap1])").to.deep.equal([ap2]);
    }

    @test() public async findAllHosts() {
        const ap1 = this.authProvider({ id: "1", oauthRevision: "rev1", host: "foo" });
        const ap2 = this.authProvider({ id: "2", oauthRevision: "rev2", host: "BAR" });
        await this.db.storeAuthProvider(ap1, false);
        await this.db.storeAuthProvider(ap2, false);

        const all = await this.db.findAllHosts();
        expect(all, "findAllHosts([])").to.deep.equal(["foo", "bar"]);
    }

    @test() public async oauthRevision() {
        const ap = this.authProvider({ id: "1" });
        await this.db.storeAuthProvider(ap, true);

        const loadedAp = await this.db.findByHost(ap.host);
        expect(loadedAp, "findByHost()").to.deep.equal(ap);
        expect(loadedAp?.oauthRevision, "findByHost()").to.equal(
            "3d1390670fd19c27157d046960c3d7c46df81db642302dea1a9fe86cf0594361",
        );
    }

    @test() public async findByOrgId() {
        const ap1 = this.authProvider({ id: "1", organizationId: "O1", host: "H1" });
        const ap2 = this.authProvider({ id: "2", organizationId: "O1", host: "H2" });
        const ap3 = this.authProvider({ id: "3", organizationId: "O2", host: "H1" });

        await this.db.storeAuthProvider(ap1, false);
        await this.db.storeAuthProvider(ap2, false);
        await this.db.storeAuthProvider(ap3, false);

        const results = await this.db.findByOrgId("O1");
        expect(results.length).to.equal(2);
        expect(results).to.deep.contain(ap1);
        expect(results).to.deep.contain(ap2);
    }

    @test() public async findByUserId() {
        const ap1 = this.authProvider({ id: "1", ownerId: "owner1" });
        const ap2 = this.authProvider({ id: "2", ownerId: "owner1", organizationId: "org1" });

        await this.db.storeAuthProvider(ap1, false);
        await this.db.storeAuthProvider(ap2, false);

        const results = await this.db.findByUserId("owner1");
        expect(results.length).to.equal(1);
        expect(results).to.deep.contain(ap1);
    }
}

module.exports = AuthProviderEntryDBSpec;
