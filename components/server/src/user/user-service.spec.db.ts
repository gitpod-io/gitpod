/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container } from "inversify";
import { createTestContainer } from "../test/service-testing-container-module";
import { UserService } from "./user-service";
import { DBUser, TypeORM } from "@gitpod/gitpod-db/lib";

const expect = chai.expect;

describe("UserService", async () => {
    let container: Container;
    let userService: UserService;

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({
            centralizedPermissions: true,
        });
        userService = container.get<UserService>(UserService);
    });

    afterEach(async () => {
        const typeorm = container.get(TypeORM);
        const conn = await typeorm.getConnection();
        await conn.getRepository(DBUser).clear();
    });

    it("updateLoggedInUser_avatarUrlNotUpdatable", async () => {
        const user = await userService.createUser({
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });

        const updated = await userService.updateUser(user.id, {
            avatarUrl: "evil-payload",
        });

        // The update to avatarUrl is not applied
        expect(updated.avatarUrl).is.undefined;
    });
});
