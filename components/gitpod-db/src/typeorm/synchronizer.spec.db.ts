/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test, timeout } from "mocha-typescript";
import { testContainer } from "../test-container";
import { UserDB } from "../user-db";
import { TypeORM } from "./typeorm";
import { DBUser } from "./entity/db-user";
import * as chai from "chai";
import { Synchronizer } from "./synchronizer";
import { User } from "@gitpod/gitpod-protocol";
const expect = chai.expect;

@suite(timeout(10000))
export class SynchronizerSpec {
    private readonly synchronizer = testContainer.get<Synchronizer>(Synchronizer);
    private readonly userDB = testContainer.get<UserDB>(UserDB);

    async before() {
        await this.wipeRepo();
    }

    async after() {
        await this.wipeRepo();
    }

    async wipeRepo() {
        const typeorm = testContainer.get<TypeORM>(TypeORM);
        const manager = await typeorm.getConnection();
        await manager.getRepository(DBUser).delete({});
    }

    @test()
    async testSynchronize(): Promise<void> {
        const user = await this.userDB.newUser();
        const all: Promise<void>[] = [];
        for (let i = 0; i < 20; i++) {
            all.push(
                this.synchronizer.synchronized(user.id, "testSynchronize", async () => {
                    try {
                        const loadedUser = (await this.userDB.findUserById(user.id)) as User;
                        if (!loadedUser?.name) {
                            loadedUser!.name = "1";
                        } else {
                            loadedUser!.name = String(Number(loadedUser!.name) + 1);
                        }
                        await this.userDB.storeUser(loadedUser);
                    } catch (error) {
                        console.error(error);
                    }
                }),
            );
        }
        await Promise.all(all);
        const afterSyncUser = await this.userDB.findUserById(user.id);
        expect(afterSyncUser!.name).to.be.eq("20");
    }
}
