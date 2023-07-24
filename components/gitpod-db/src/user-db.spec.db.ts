/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
const expect = chai.expect;
import { suite, test, timeout } from "@testdeck/mocha";

import { GitpodTokenType, Identity, Workspace, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { testContainer } from "./test-container";
import { DBIdentity } from "./typeorm/entity/db-identity";
import { TypeORMUserDBImpl } from "./typeorm/user-db-impl";
import { TypeORMWorkspaceDBImpl } from "./typeorm/workspace-db-impl";
import { TypeORM } from "./typeorm/typeorm";
import { resetDB } from "./test/reset-db";

const _IDENTITY1: Identity = {
    authProviderId: "GitHub",
    authId: "1234",
    authName: "gero",
    deleted: false,
    lastSigninTime: undefined,
    primaryEmail: undefined,
    readonly: false,
};
const _IDENTITY2: Identity = {
    authProviderId: "GitHub",
    authId: "4321",
    authName: "gero",
    deleted: false,
    lastSigninTime: undefined,
    primaryEmail: undefined,
    readonly: false,
};
const WRONG_ID = "123"; // no uuid

@suite
class UserDBSpec {
    db = testContainer.get<TypeORMUserDBImpl>(TypeORMUserDBImpl);

    wsDb = testContainer.get<TypeORMWorkspaceDBImpl>(TypeORMWorkspaceDBImpl);

    async before() {
        await this.wipeRepos();
    }

    async after() {
        await this.wipeRepos();
    }

    async wipeRepos() {
        const typeorm = testContainer.get<TypeORM>(TypeORM);
        await resetDB(typeorm);
    }

    // Copy to avoid pollution
    get IDENTITY1() {
        return Object.assign({}, _IDENTITY1);
    }
    get IDENTITY2() {
        return Object.assign({}, _IDENTITY2);
    }

    @test(timeout(10000))
    public async createUserAndFindById() {
        let user = await this.db.newUser();
        user.identities.push(this.IDENTITY1);
        user = await this.db.storeUser(user);

        const dbResult = await this.db.findUserById(user.id);
        // We use 'user' as reference, so clean it
        // @ts-ignore
        user.identities.forEach((i) => delete (i as DBIdentity).user);
        expect(dbResult).to.deep.include(user);
    }

    @test(timeout(10000))
    public async createUserAndNotFindByWrongId() {
        let user = await this.db.newUser();
        user.identities.push(this.IDENTITY2);
        user = await this.db.storeUser(user);
        expect(await this.db.findUserById(WRONG_ID)).to.be.undefined;
    }

    @test(timeout(10000))
    public async createUserAndFindByIdentity() {
        let user = await this.db.newUser();
        user.identities.push(this.IDENTITY1);
        user = await this.db.storeUser(user);

        const dbResult = await this.db.findUserByIdentity(this.IDENTITY1);
        // We use 'user' as reference, so clean it
        // @ts-ignore
        user.identities.forEach((i) => delete (i as DBIdentity).user);
        expect(dbResult).to.deep.include(user);
    }

    @test(timeout(10000))
    public async findUsersByEmail_multiple_users_identities() {
        let user1 = await this.db.newUser();
        user1.name = "Old";
        user1.identities.push(TestData.ID1);
        user1.identities.push(TestData.ID2);
        user1.identities.push(TestData.ID3);
        user1 = await this.db.storeUser(user1);

        await this.wsDb.store({
            ...TestData.DEFAULT_WS,
            id: "1",
            creationTime: new Date().toISOString(),
            ownerId: user1.id,
        });
        await this.wsDb.storeInstance({
            ...TestData.DEFAULT_WSI,
            workspaceId: "1",
            id: "11",
            creationTime: new Date().toISOString(),
        });

        // ensure that the second user's last modified is definitely after first one's
        await new Promise((resolve) => setTimeout(resolve, 100));

        let user2 = await this.db.newUser();
        user2.name = "New";
        user2.identities.push(TestData.ID4);
        user2.identities.push(TestData.ID5);
        user2 = await this.db.storeUser(user2);

        await this.wsDb.store({
            ...TestData.DEFAULT_WS,
            id: "2",
            creationTime: new Date().toISOString(),
            ownerId: user2.id,
        });
        await this.wsDb.storeInstance({
            ...TestData.DEFAULT_WSI,
            workspaceId: "2",
            id: "22",
            creationTime: new Date().toISOString(),
        });

        const dbResult = await this.db.findUsersByEmail(TestData.primaryEmail);

        expect(dbResult).to.be.an("array");
        expect(dbResult).to.be.have.length(2);
        expect(dbResult[0].name).to.be.eq("New");
        expect(dbResult[1].name).to.be.eq("Old");
    }

    @test(timeout(10000))
    public async findUserByIdentity_after_moving_identity() {
        let user1 = await this.db.newUser();
        user1.name = "ABC";
        user1.identities.push(TestData.ID1);
        user1.identities.push(TestData.ID2);
        user1 = await this.db.storeUser(user1);

        let user2 = await this.db.newUser();
        user2.name = "XYZ";
        user2.identities.push(TestData.ID3);
        user2 = await this.db.storeUser(user2);
        user2.identities.push(TestData.ID2);
        user2 = await this.db.storeUser(user2);

        const r2 = await this.db.findUserByIdentity(TestData.ID1);
        expect(r2).to.be.not.undefined;
        expect(r2!.identities).to.have.length(1);

        const r1 = await this.db.findUserByIdentity(TestData.ID2);
        expect(r1).to.be.not.undefined;
        expect(r1!.name).to.be.eq("XYZ");
    }

    @test(timeout(10000))
    public async findOrgOwnedUser_by_email() {
        let orgUser1 = await this.db.newUser();
        orgUser1.organizationId = "org1";
        orgUser1.name = "Tester";
        orgUser1.identities.push({
            authId: "123",
            authName: "Tester",
            authProviderId: "oauth2-client-id",
            primaryEmail: "tester@some.org",
        });
        orgUser1 = await this.db.storeUser(orgUser1);

        const result = await this.db.findOrgOwnedUser("org1", "tester@some.org");
        expect(result, "organizational user should be found").not.to.be.undefined;
        expect(result!.identities, "should find a single identity").to.have.length(1);

        const result2 = await this.db.findOrgOwnedUser("org1", "unknown@some.org");
        expect(result2, "no user should be found").to.be.undefined;
    }

    @test(timeout(10000))
    public async findTokenAndOwner() {
        let user1 = await this.db.newUser();
        user1.name = "ABC";
        user1.identities.push(TestData.ID1);
        user1.identities.push(TestData.ID2);
        user1 = await this.db.storeUser(user1);

        await this.db.storeGitpodToken({
            tokenHash: "tokenhash",
            created: new Date().toISOString(),
            scopes: ["read-only"],
            type: GitpodTokenType.API_AUTH_TOKEN,
            userId: user1.id,
        });
        const result = await this.db.findUserByGitpodToken("tokenhash");
        expect(result).to.not.be.undefined;
        expect(result?.user.id).to.eq(user1.id);
        expect(result?.token.userId).to.eq(user1.id);
    }

    @test(timeout(10000))
    public async findGitpodTokenOfUser() {
        let user1 = await this.db.newUser();
        user1.name = "ABC";
        user1.identities.push(TestData.ID1);
        user1.identities.push(TestData.ID2);
        user1 = await this.db.storeUser(user1);

        const token = {
            tokenHash: "tokenhash",
            created: new Date().toISOString(),
            scopes: ["read-only"],
            type: GitpodTokenType.API_AUTH_TOKEN,
            userId: user1.id,
        };
        await this.db.storeGitpodToken(token);
        const result = await this.db.findGitpodTokensOfUser(user1.id, token.tokenHash);
        expect(result).to.not.be.undefined;
        expect(result?.userId).to.eq(user1.id);
        expect(result?.tokenHash).to.eq(token.tokenHash);
    }

    @test(timeout(10000))
    public async findAllGitpodTokensOfUser() {
        let user1 = await this.db.newUser();
        user1.name = "ABC";
        user1.identities.push(TestData.ID1);
        user1.identities.push(TestData.ID2);
        user1 = await this.db.storeUser(user1);

        const token = {
            tokenHash: "tokenhash",
            created: new Date().toISOString(),
            scopes: ["read-only"],
            type: GitpodTokenType.API_AUTH_TOKEN,
            userId: user1.id,
        };
        await this.db.storeGitpodToken(token);
        const token2 = {
            tokenHash: "tokenhash2",
            created: new Date().toISOString(),
            scopes: ["read-only"],
            type: GitpodTokenType.API_AUTH_TOKEN,
            userId: user1.id,
        };
        await this.db.storeGitpodToken(token2);
        const result = await this.db.findAllGitpodTokensOfUser(user1.id);
        expect(result).to.not.be.undefined;
        expect(result.length).to.eq(2);
        expect(result.some((t) => t.tokenHash === token.tokenHash)).to.be.true;
        expect(result.some((t) => t.tokenHash === token2.tokenHash)).to.be.true;
    }
}

namespace TestData {
    export const primaryEmail = "foo@bar.com";
    const DEFAULT: Identity = {
        authProviderId: "Public-GitHub",
        primaryEmail,
        authId: "1234",
        authName: "Foo Bar",
        deleted: false,
        readonly: false,
    };
    export const organizationId: string = "org1";
    export const ID1: Identity = { ...DEFAULT, authId: "2345" };
    export const ID2: Identity = { ...DEFAULT, authId: "3456", authProviderId: "Public-GitLab" };
    export const ID3: Identity = { ...DEFAULT, authId: "4567", authProviderId: "ACME" };
    export const ID4: Identity = { ...DEFAULT, authId: "5678" };
    export const ID5: Identity = { ...DEFAULT, authId: "6789", authProviderId: "ACME" };
    export const DEFAULT_WS: Workspace = {
        id: "1",
        type: "regular",
        creationTime: new Date().toISOString(),
        config: {
            ports: [],
            image: "",
            tasks: [],
        },
        organizationId,
        context: { title: "example" },
        contextURL: "example.org",
        description: "blabla",
        ownerId: "12345",
    };
    export const DEFAULT_WSI: WorkspaceInstance = {
        workspaceId: DEFAULT_WS.id,
        id: "123",
        ideUrl: "example.org",
        region: "unknown",
        workspaceImage: "abc.io/test/image:123",
        creationTime: new Date().toISOString(),
        startedTime: undefined,
        deployedTime: undefined,
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
    };
}

module.exports = new UserDBSpec();
