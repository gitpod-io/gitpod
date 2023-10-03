/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { testContainer } from "./test-container";
import { TypeORM } from "./typeorm/typeorm";
import { DBAuthProviderEntry } from "./typeorm/entity/db-auth-provider-entry";
import { DeepPartial } from "@gitpod/gitpod-protocol/lib/util/deep-partial";
import { resetDB } from "./test/reset-db";
import { AuthProviderEntryDB } from "./auth-provider-entry-db";
import { expect } from "chai";
import "mocha";

const container = testContainer.createChild();

describe("AuthProviderEntryDBSpec", async () => {
    let db: AuthProviderEntryDB;

    beforeEach(async () => {
        db = container.get<AuthProviderEntryDB>(AuthProviderEntryDB);
    });

    afterEach(async () => {
        const typeorm = container.get<TypeORM>(TypeORM);
        await resetDB(typeorm);
    });

    function authProvider(ap: DeepPartial<DBAuthProviderEntry> = {}): DBAuthProviderEntry {
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

    it("should findAll", async () => {
        const ap1 = authProvider({ id: "1", oauthRevision: "rev1" });
        const ap2 = authProvider({ id: "2", oauthRevision: "rev2" });
        await db.storeAuthProvider(ap1, false);
        await db.storeAuthProvider(ap2, false);

        const all = await db.findAll();
        expect(all, "findAll([])").to.deep.equal([ap1, ap2]);
        expect(await db.findAll([ap1.oauthRevision!, ap2.oauthRevision!]), "findAll([ap1, ap2])").to.be.empty;
        expect(await db.findAll([ap1.oauthRevision!]), "findAll([ap1])").to.deep.equal([ap2]);
    }).timeout(30000); // this test is sometimes slow because it is the first one and ts-node needs to compile

    it("should findAllHosts", async () => {
        const ap1 = authProvider({ id: "1", oauthRevision: "rev1", host: "foo" });
        const ap2 = authProvider({ id: "2", oauthRevision: "rev2", host: "BAR" });
        await db.storeAuthProvider(ap1, false);
        await db.storeAuthProvider(ap2, false);

        const all = await db.findAllHosts();
        expect(all, "findAllHosts([])").to.deep.equal(["foo", "bar"]);
    });

    it("should oauthRevision", async () => {
        const ap = authProvider({ id: "1" });
        await db.storeAuthProvider(ap, true);

        const loadedAp = await db.findByHost(ap.host);
        expect(loadedAp, "findByHost()").to.deep.equal(ap);
        expect(loadedAp?.oauthRevision, "findByHost()").to.equal(
            "3d1390670fd19c27157d046960c3d7c46df81db642302dea1a9fe86cf0594361",
        );
    });

    it("should findByOrgId()", async () => {
        const ap1 = authProvider({ id: "1", organizationId: "O1", host: "H1" });
        const ap2 = authProvider({ id: "2", organizationId: "O1", host: "H2" });
        const ap3 = authProvider({ id: "3", organizationId: "O2", host: "H1" });

        await db.storeAuthProvider(ap1, false);
        await db.storeAuthProvider(ap2, false);
        await db.storeAuthProvider(ap3, false);

        const results = await db.findByOrgId("O1");
        expect(results.length).to.equal(2);
        expect(results).to.deep.contain(ap1);
        expect(results).to.deep.contain(ap2);
    });

    it("should findByUserId", async () => {
        const ap1 = authProvider({ id: "1", ownerId: "owner1" });
        const ap2 = authProvider({ id: "2", ownerId: "owner1", organizationId: "org1" });

        await db.storeAuthProvider(ap1, false);
        await db.storeAuthProvider(ap2, false);

        const results = await db.findByUserId("owner1");
        expect(results.length).to.equal(1);
        expect(results).to.deep.contain(ap1);
    });
});
