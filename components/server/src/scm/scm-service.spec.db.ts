/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM } from "@gitpod/gitpod-db/lib";
import { User } from "@gitpod/gitpod-protocol";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { createTestContainer } from "../test/service-testing-container-module";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { UserService } from "../user/user-service";
import { Config } from "../config";
import { ScmService } from "./scm-service";
import { AuthProviderParams } from "../auth/auth-provider";
import { expectError } from "../test/expect-utils";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

const expect = chai.expect;

describe("ScmService", async () => {
    let service: ScmService;
    let userService: UserService;
    let container: Container;
    let currentUser: User;

    const addBuiltInProvider = (host: string = "github.com") => {
        const config = container.get<Config>(Config);
        config.builtinAuthProvidersConfigured = true;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        config.authProviderConfigs.push((<Partial<AuthProviderParams>>{
            host,
            id: "Public-GitHub",
            verified: true,
        }) as any);
    };

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({});
        service = container.get(ScmService);
        userService = container.get<UserService>(UserService);
        currentUser = await userService.createUser({
            identity: {
                authId: "gh-user-1",
                authName: "user",
                authProviderId: "public-github",
            },
        });
        addBuiltInProvider("github.com");
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
        // Deactivate all services
        await container.unbindAllAsync();
    });

    describe("getToken", async () => {
        it("should return current user's token", async () => {
            const token = await service.getToken(currentUser.id, { host: "github.com" });
            expect(token?.value).to.equal("test");
        });
        it("should fail if user is not found", async () => {
            const getToken = service.getToken("0000-0000-0000-0000", { host: "github.com" });
            await expectError(ErrorCodes.NOT_FOUND, () => getToken);
        });
        it("should fail if token is not found", async () => {
            const getToken = service.getToken(currentUser.id, { host: "unknown.com" });
            await expectError(ErrorCodes.NOT_FOUND, () => getToken);
        });
    });
});
