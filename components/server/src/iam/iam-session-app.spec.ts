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
const expect = chai.expect;

@suite(timeout(10000))
class TestIamSessionApp {
    protected app: IamSessionApp;
    protected store: session.MemoryStore;

    protected cookieName = "test-session-name";

    public before() {
        const container = new Container();
        container.load(
            new ContainerModule((bind) => {
                bind(SessionHandlerProvider).toConstantValue(<any>{}); // disable due to DB dependency
                bind(IamSessionApp).toSelf().inSingletonScope();
                bind(Authenticator).toConstantValue(<any>{}); // unused
                bind(Config).toConstantValue(<any>{}); // unused
                bind(UserService).toConstantValue(<any>{
                    createUser: () => ({
                        id: "C0FFEE",
                    }),
                });
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
            .send(JSON.stringify(this.idToken));

        expect(count, "sessions added").to.equal(1);
    }

    @test public async testSessionRequestResponsesWithSetCookie() {
        const result = await request(this.app.create())
            .post("/session")
            .set("Content-Type", "application/json")
            .send(JSON.stringify(this.idToken));

        expect(result.statusCode).to.equal(200);
        expect(JSON.stringify(result.get("Set-Cookie"))).to.contain(this.cookieName);
    }

    idToken = {};
}

module.exports = new TestIamSessionApp();
