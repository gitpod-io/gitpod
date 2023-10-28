/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM, resetDB } from "@gitpod/gitpod-db/lib";
import { User } from "@gitpod/gitpod-protocol";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { expect } from "chai";
import * as express from "express";
import { Container } from "inversify";
import { v4 } from "uuid";
import { SessionHandler } from "./session-handler";
import { createTestContainer } from "./test/service-testing-container-module";
import { UserService } from "./user/user-service";

describe("SessionHandler", () => {
    let container: Container;
    let sessionHandler: SessionHandler;
    let existingUser: User;
    let jwtSessionHandler: express.Handler;
    interface Response {
        status?: number;
        value?: string;
        cookie?: string;
    }
    const handle = async (user?: User, cookie?: string): Promise<Response> => {
        const deferred = new Deferred<Response>();
        const result: Response = {
            status: undefined,
            value: undefined,
            cookie: undefined,
        };
        jwtSessionHandler(
            { user, headers: { cookie } } as express.Request,
            {
                status: function (statusCode: number) {
                    result.status = statusCode;
                    return this;
                },
                send: function (value: string) {
                    result.value = value;
                    deferred.resolve(result);
                },
                cookie: function (name: string, value: string, opts: express.CookieOptions) {
                    result.cookie = `${name}=${value}; `;
                },
            } as any as express.Response,
            () => {},
        );
        return await deferred.promise;
    };

    beforeEach(async () => {
        container = createTestContainer();
        sessionHandler = container.get(SessionHandler);
        jwtSessionHandler = sessionHandler.jwtSessionConvertor();
        const userService = container.get(UserService);
        // insert some users to the DB to reproduce INC-379
        await userService.createUser({
            identity: {
                authName: "github",
                authProviderId: "github",
                authId: "1234",
            },
        });
        existingUser = await userService.createUser({
            identity: {
                authName: "github",
                authProviderId: "github",
                authId: "1234",
            },
        });
    });

    afterEach(async () => {
        const typeorm = container.get(TypeORM);
        await resetDB(typeorm);
    });

    describe("verify", () => {
        it("should return undefined for an empty cookie", async () => {
            const user = await sessionHandler.verify("");
            expect(user).to.be.undefined;
        });
        it("should return undefined for an invalid cookie", async () => {
            const user = await sessionHandler.verify("invalid");
            expect(user).to.be.undefined;
        });
        it("should return the user for a valid JWT with correct 'sub' claim", async () => {
            const cookie = await sessionHandler.createJWTSessionCookie(existingUser.id);
            const user = await sessionHandler.verify(`${cookie.name}=${cookie.value}`);
            expect(user?.id).to.be.equal(existingUser.id);
        });
        it("should return undefined for a valid JWT with incorrect 'sub' claim", async () => {
            const unexisingUserId = v4();
            const cookie = await sessionHandler.createJWTSessionCookie(unexisingUserId);
            const user = await sessionHandler.verify(`${cookie.name}=${cookie.value}`);
            expect(user).to.be.undefined;
        });
    });
    describe("createJWTSessionCookie", () => {
        it("should create a valid JWT token with correct attributes and cookie options", async () => {
            const maxAge = 7 * 24 * 60 * 60;
            const issuedAfter = Math.floor(new Date().getTime() / 1000);
            const expiresAfter = issuedAfter + maxAge;
            const { name, value: token, opts } = await sessionHandler.createJWTSessionCookie("1");

            const decoded = await sessionHandler.verifyJWTCookie(`${name}=${token}`);
            expect(decoded, "Verify the JWT is valid").to.not.be.null;

            expect(decoded!.sub).to.equal("1", "Check the 'sub' claim");
            expect(decoded!.iat || 0).to.be.greaterThanOrEqual(issuedAfter, "Check the 'iat' claim");
            expect(decoded!.exp || 0).to.be.greaterThanOrEqual(expiresAfter, "Check the 'exp' claim");

            // Check cookie options
            expect(opts.httpOnly).to.equal(true);
            expect(opts.secure).to.equal(true);
            expect(opts.maxAge).to.equal(maxAge * 1000);
            expect(opts.sameSite).to.equal("strict");

            expect(name, "Check cookie name").to.equal("_gitpod_dev_jwt_");
        });
    });
    describe("jwtSessionConvertor", () => {
        it("user is not authenticated", async () => {
            const res = await handle();
            expect(res.status).to.equal(401);
            expect(res.value).to.equal("User has no valid session.");
            expect(res.cookie).to.be.undefined;
        });
        it("JWT cookie is not present", async () => {
            const res = await handle(existingUser);
            expect(res.status).to.equal(200);
            expect(res.value).to.equal("New JWT cookie issued.");
            expect(res.cookie).not.to.be.undefined;
        });
        it("JWT cookie is present and valid", async () => {
            const cookie = await sessionHandler.createJWTSessionCookie(existingUser.id);
            const res = await handle(existingUser, `${cookie.name}=${cookie.value}`);
            expect(res.status).to.equal(200);
            expect(res.value).to.equal("User session already has a valid JWT session.");
            expect(res.cookie).to.be.undefined;
        });
        it("JWT cookie is present and refreshed", async () => {
            const cookieToRefresh = await sessionHandler.createJWTSessionCookie(existingUser.id, {
                issuedAtMs: Date.now() - SessionHandler.JWT_REFRESH_THRESHOLD - 1,
            });
            const res = await handle(existingUser, `${cookieToRefresh.name}=${cookieToRefresh.value}`);
            expect(res.status).to.equal(200);
            expect(res.value).to.equal("Refreshed JWT cookie issued.");
            expect(res.cookie).not.to.be.undefined;
        });
        it("JWT cookie is present and expired", async () => {
            const expiredCookie = await sessionHandler.createJWTSessionCookie(existingUser.id, {
                expirySeconds: 0,
            });
            const res = await handle(existingUser, `${expiredCookie.name}=${expiredCookie.value}`);
            expect(res.status).to.equal(401);
            expect(res.value).to.equal("JWT Session is invalid");
            expect(res.cookie).to.be.undefined;
        });
        it("JWT cookie is present but invalid", async () => {
            const res = await handle(existingUser, "_gitpod_dev_jwt_=invalid");
            expect(res.status).to.equal(401);
            expect(res.value).to.equal("JWT Session is invalid");
            expect(res.cookie).to.be.undefined;
        });
    });
});
