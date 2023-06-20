/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DBUser, TypeORM, UserDB } from "@gitpod/gitpod-db/lib";
import { Container } from "inversify";
import { suite, test } from "mocha-typescript";
import { DBTeam } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team";
import { UserService } from "./user-service";
import * as chai from "chai";
import { dbContainerModule } from "@gitpod/gitpod-db/lib/container-module";
import { productionContainerModule } from "../container-module";
import { Config } from "../config";
import { UserToTeamMigrationService } from "../migration/user-to-team-migration-service";
import { User } from "@gitpod/gitpod-protocol";

const expect = chai.expect;

const testContainer = new Container();
testContainer.load(dbContainerModule());
testContainer.load(productionContainerModule);
testContainer.rebind(Config).toConstantValue({
    blockNewUsers: {
        enabled: false,
    },
} as any);
testContainer.rebind(UserToTeamMigrationService).toConstantValue({
    migrateUser: (user: User) => {
        return user;
    },
} as any);

@suite
class UserServiceSpec {
    userDB = testContainer.get<UserDB>(UserDB);

    async before() {
        await this.wipeRepos();
    }

    async after() {
        await this.wipeRepos();
    }

    async wipeRepos() {
        const typeorm = testContainer.get<TypeORM>(TypeORM);
        const mnr = await typeorm.getConnection();
        await mnr.getRepository(DBUser).delete({});
        await mnr.getRepository(DBTeam).delete({});
    }

    @test
    public async updateLoggedInUser_avatarUrlNotUpdatable() {
        const sut = testContainer.get<UserService>(UserService);

        const user = await sut.createUser({
            identity: {
                authId: "foo",
                authName: "bar",
                authProviderId: "github",
                primaryEmail: "yolo@yolo.com",
            },
        });

        const updated = await sut.updateUser(user.id, {
            avatarUrl: "evil-payload",
        });

        // The update to avatarUrl is not applied
        expect(updated.avatarUrl).is.undefined;
    }
}

module.exports = new UserServiceSpec();
