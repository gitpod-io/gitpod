/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DBUser, TeamDB, TypeORM, TypeORMUserDBImpl, testContainer } from "@gitpod/gitpod-db/lib";
import { Container } from "inversify";
import { HostContextProvider } from "../auth/host-context-provider";
import { UsageService } from "./usage-service";
import { UserToTeamMigrationService } from "../migration/user-to-team-migration-service";
import { suite, test } from "mocha-typescript";
import { DBTeam } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team";
import { UserService } from "./user-service";
import * as chai from "chai";

const expect = chai.expect;

@suite
class UserServiceSpec {
    private container: Container;
    userDB = testContainer.get<TypeORMUserDBImpl>(TypeORMUserDBImpl);

    async before() {
        this.container = testContainer.createChild();
        this.container.bind(HostContextProvider).toConstantValue({} as any);
        this.container.bind(UsageService).toConstantValue({} as any);
        this.container.bind(UserToTeamMigrationService).toConstantValue({} as any);

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
        const sut = this.container.get<UserService>(UserService);

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
        expect(updated).to.eq(user);
    }
}

module.exports = new UserServiceSpec();
