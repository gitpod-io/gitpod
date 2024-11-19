/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM, resetDB } from "@gitpod/gitpod-db/lib";
import { BearerAuth, PersonalAccessToken } from "./bearer-authenticator";
import { expect } from "chai";
import { describe } from "mocha";
import { Container } from "inversify";
import { createTestContainer } from "../test/service-testing-container-module";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { UserService } from "../user/user-service";
import { User } from "@gitpod/gitpod-protocol";
import { Config } from "../config";
import { Request } from "express";
import { WithResourceAccessGuard } from "./resource-access";
import { WithFunctionAccessGuard } from "./function-access";
import { fail } from "assert";
import { SubjectId } from "./subject-id";

function toDateTime(date: Date): string {
    return date.toISOString().replace("T", " ").replace("Z", "");
}

describe("BearerAuth", () => {
    let container: Container;
    let bearerAuth: BearerAuth;
    let userService: UserService;
    let typeORM: TypeORM;
    let testUser: User;

    async function insertPat(userId: string, patId: string, scopes: string[] = ["function:*"]): Promise<string> {
        const patValue = "someValue";
        const signature = "V7BsZVjpMQRaWxS5XJE9r-Ovpxk2xT_bfFSmic4yW6g"; // depends on the value
        const pat = new PersonalAccessToken("doesnotmatter", patValue);

        const conn = await typeORM.getConnection();
        await conn.query(
            "INSERT d_b_personal_access_token (id, userId, hash, name, scopes, expirationTime, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [patId, userId, pat.hash(), patId, scopes, toDateTime(new Date("2030")), toDateTime(new Date())],
        );
        return `gitpod_pat_${signature}.${patValue}`;
    }

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({});
        const oldConfig = container.get<Config>(Config);
        container.rebind(Config).toDynamicValue((ctx) => {
            return {
                ...oldConfig,
                patSigningKey: "super-duper-secret-pat-signing-key",
            };
        });
        bearerAuth = container.get(BearerAuth);
        userService = container.get<UserService>(UserService);
        typeORM = container.get<TypeORM>(TypeORM);

        testUser = await userService.createUser({
            identity: {
                authId: "gh-user-1",
                authName: "testUser",
                authProviderId: "public-github",
            },
        });
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
        // Deactivate all services
        await container.unbindAllAsync();
    });

    it("authExpressRequest should successfully authenticate BearerToken (PAT)", async () => {
        const pat1 = await insertPat(testUser.id, "pat-1");

        const req = {
            headers: {
                authorization: `Bearer ${pat1}`,
            },
        } as Request;
        await bearerAuth.authExpressRequest(req);

        expect(req.user?.id).to.equal(testUser.id);
        expect((req as WithResourceAccessGuard).resourceGuard).to.not.be.undefined;
        expect((req as WithFunctionAccessGuard).functionGuard).to.not.be.undefined;
    });

    it("authExpressRequest should fail to authenticate with missing BearerToken in header", async () => {
        await insertPat(testUser.id, "pat-1");

        const req = {
            headers: {
                authorization: `Bearer `, // missing
            },
        } as Request;
        await expectError(async () => bearerAuth.authExpressRequest(req), "missing bearer token header");
    });

    it("authExpressRequest should fail to authenticate with missing BearerToken from DB (PAT)", async () => {
        const patNotStored = "gitpod_pat_GrvGthczSRf3ypqFhNtcRiN5fK6CV7rdCkkPLfpbc_4";

        const req = {
            headers: {
                authorization: `Bearer ${patNotStored}`,
            },
        } as Request;
        await expectError(async () => bearerAuth.authExpressRequest(req), "cannot find token");
    });

    it("tryAuthFromHeaders should successfully authenticate BearerToken (PAT)", async () => {
        const pat1 = await insertPat(testUser.id, "pat-1");

        const headers = new Headers();
        headers.set("authorization", `Bearer ${pat1}`);
        const subjectId = await bearerAuth.tryAuthFromHeaders(headers);

        expect(subjectId?.toString()).to.equal(SubjectId.fromUserId(testUser.id).toString());
    });

    it("tryAuthFromHeaders should return undefined with missing BearerToken in header", async () => {
        await insertPat(testUser.id, "pat-1");

        const headers = new Headers();
        headers.set("authorization", `Bearer `); // missing
        expect(await bearerAuth.tryAuthFromHeaders(headers)).to.be.undefined;
    });

    it("tryAuthFromHeaders should fail to authenticate with missing BearerToken from DB (PAT)", async () => {
        const patNotStored = "gitpod_pat_GrvGthczSRf3ypqFhNtcRiN5fK6CV7rdCkkPLfpbc_4";

        const headers = new Headers();
        headers.set("authorization", `Bearer ${patNotStored}`);
        await expectError(async () => bearerAuth.tryAuthFromHeaders(headers), "cannot find token");
    });

    async function expectError(fun: () => Promise<any>, message: string) {
        try {
            await fun();
            fail(`Expected error: ${message}`);
        } catch (err) {}
    }
});
