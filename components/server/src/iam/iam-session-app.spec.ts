/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Container, ContainerModule } from "inversify";
import { suite, test, timeout } from "mocha-typescript";
import { SessionHandlerProvider } from "../session-handler";
import { IamSessionApp } from "./iam-session-app";
import { Config } from "../config";
import { Authenticator } from "../auth/authenticator";
import { UserService } from "../user/user-service";

import * as passport from "passport";
import * as express from "express";
import * as session from "express-session";
import * as request from "supertest";

import * as chai from "chai";
import { OIDCCreateSessionPayload } from "./iam-oidc-create-session-payload";
import { BUILTIN_INSTLLATION_ADMIN_USER_ID, TeamDB } from "@gitpod/gitpod-db/lib";
import { TeamMemberInfo } from "@gitpod/gitpod-protocol";
const expect = chai.expect;

@suite(timeout(10000))
class TestIamSessionApp {
    protected app: IamSessionApp;
    protected store: session.MemoryStore;

    protected cookieName = "test-session-name";

    protected knownSub = "111";

    protected userServiceMock: Partial<UserService> = {
        createUser: (params) => {
            return { id: "id-new-user" } as any;
        },

        findUserForLogin: (params) => {
            if (params.candidate?.authId === this.knownSub) {
                return { id: "id-known-user" } as any;
            }
            return undefined;
        },
    };

    protected teamDbMock: Partial<TeamDB> & { memberships: Set<string> } = {
        memberships: new Set<string>(), // simply assuming single org here!
        findMembersByTeam: async (teamId: string): Promise<TeamMemberInfo[]> => {
            return [];
        },
        async addMemberToTeam(userId: string, teamId: string): Promise<"added" | "already_member"> {
            this.memberships.add(userId);
            return "added";
        },
        setTeamMemberRole: async (userId, teamId, role): Promise<void> => {},
        async removeMemberFromTeam(userId, teamId): Promise<void> {
            this.memberships.delete(userId);
        },
    };

    protected payload: OIDCCreateSessionPayload = {
        idToken: {} as any,
        claims: {
            aud: "1234",
            email: "user@test.net",
            email_verified: true,
            family_name: "User",
            given_name: "Test",
            iss: "https://accounts.get.net",
            locale: "de",
            name: "Test User",
            picture: "https://cdn.get.net/users/abc23",
            sub: "1234567890",
            hd: "test.net",
        },
        organizationId: "test-org",
        oidcClientConfigId: "oidc-client-123",
    };

    public before() {
        this.teamDbMock.memberships.clear();

        const container = new Container();
        container.load(
            new ContainerModule((bind) => {
                bind(SessionHandlerProvider).toConstantValue(<any>{}); // disable due to DB dependency
                bind(IamSessionApp).toSelf().inSingletonScope();
                bind(Authenticator).toConstantValue(<any>{}); // unused
                bind(Config).toConstantValue(<any>{}); // unused
                bind(UserService).toConstantValue(this.userServiceMock as any);
                bind(TeamDB).toConstantValue(this.teamDbMock as TeamDB);
            }),
        );
        this.app = container.get(IamSessionApp);
        passport.serializeUser<string>((user: any, done) => done(null, user.id));

        this.store = new session.MemoryStore();
        this.app.getMiddlewares = () => [
            express.json(),
            session({
                secret: "test123",
                store: this.store,
                resave: true,
                saveUninitialized: true,
                name: this.cookieName,
                genid: () => "session-123",
            }),
            passport.initialize(),
            passport.session(),
        ];
    }

    @test public async testSessionRequestStoresNewSession() {
        var _set = this.store.set;
        var count = 0;

        this.store.set = function set() {
            count++;
            return _set.apply(this, arguments as any);
        };
        await request(this.app.create())
            .post("/session")
            .set("Content-Type", "application/json")
            .send(JSON.stringify(this.payload));

        expect(count, "sessions added").to.equal(1);
    }

    @test public async testSessionRequestResponsesWithSetCookie_createUser() {
        const result = await request(this.app.create())
            .post("/session")
            .set("Content-Type", "application/json")
            .send(JSON.stringify(this.payload));

        expect(result.statusCode, JSON.stringify(result.body)).to.equal(200);
        expect(result.body?.userId).to.equal("id-new-user");
        expect(JSON.stringify(result.get("Set-Cookie"))).to.contain(this.cookieName);
    }

    @test public async testSessionRequestResponsesWithSetCookie_knownUser() {
        const payload = { ...this.payload };
        payload.claims.sub = this.knownSub;
        const result = await request(this.app.create())
            .post("/session")
            .set("Content-Type", "application/json")
            .send(JSON.stringify(payload));

        expect(result.statusCode, JSON.stringify(result.body)).to.equal(200);
        expect(result.body?.userId).to.equal("id-known-user");
        expect(JSON.stringify(result.get("Set-Cookie"))).to.contain(this.cookieName);
    }

    @test public async testInvalidPayload() {
        const cases = [
            { claims: { sub: "" }, expectedMessage: "Subject is missing" },
            { claims: { iss: "" }, expectedMessage: "Issuer is missing" },
            { claims: { email: "" }, expectedMessage: "Email is missing" },
            { claims: { name: "" }, expectedMessage: "Name is missing" },
        ];
        for (const c of cases) {
            const payload = { ...this.payload };
            payload.claims = { ...payload.claims, ...c.claims };

            const sr = request(this.app.create());
            const result = await sr
                .post("/session")
                .set("Content-Type", "application/json")
                .send(JSON.stringify(payload));

            expect(result.statusCode, JSON.stringify(result.body)).to.equal(400);
            expect(result.body?.message).to.equal(c.expectedMessage);
        }
    }

    @test public async testInvalidPayload_no_org_id() {
        const payload = { ...this.payload };
        (payload.organizationId as any) = "";

        const sr = request(this.app.create());
        const result = await sr.post("/session").set("Content-Type", "application/json").send(JSON.stringify(payload));

        expect(result.statusCode, JSON.stringify(result.body)).to.equal(400);
        expect(result.body?.message).to.equal("OrganizationId is missing");
    }

    @test public async testInvalidPayload_no_config_id() {
        const payload = { ...this.payload };
        (payload.oidcClientConfigId as any) = "";

        const sr = request(this.app.create());
        const result = await sr.post("/session").set("Content-Type", "application/json").send(JSON.stringify(payload));

        expect(result.statusCode, JSON.stringify(result.body)).to.equal(400);
        expect(result.body?.message).to.equal("OIDC client config id is missing");
    }

    @test public async testSessionRequest_createUser_removes_admin() {
        // assert only admin is member of the org
        await this.teamDbMock.addMemberToTeam!(BUILTIN_INSTLLATION_ADMIN_USER_ID, "test-org");
        expect(this.teamDbMock.memberships.has(BUILTIN_INSTLLATION_ADMIN_USER_ID)).to.be.true;
        expect(this.teamDbMock.memberships.has("id-new-user")).to.be.false;

        const result = await request(this.app.create())
            .post("/session")
            .set("Content-Type", "application/json")
            .send(JSON.stringify(this.payload));

        expect(result.statusCode, JSON.stringify(result.body)).to.equal(200);

        // assert no admin is member of the org
        expect(this.teamDbMock.memberships.has(BUILTIN_INSTLLATION_ADMIN_USER_ID)).to.be.false;
        expect(this.teamDbMock.memberships.has("id-new-user")).to.be.true;
    }
}

module.exports = new TestIamSessionApp();
