/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";
import { RedisPublisher } from "./publisher";
import { Container, ContainerModule } from "inversify";
import { Redis } from "ioredis";

const expect = chai.expect;
const RedisMock = require("ioredis-mock");

@suite
class TestRedisPublisher {
    protected container: Container;

    public before() {
        const client = new RedisMock() as Redis;

        this.container = new Container();
        this.container.load(
            new ContainerModule((bind) => {
                bind(Redis).toConstantValue(client);
                bind(RedisPublisher).toSelf().inSingletonScope();
            }),
        );
    }

    @test public publishInstanceUpdate() {
        const publisher = this.container.get(RedisPublisher);
        expect(() => {
            publisher.publishInstanceUpdate({
                ownerID: "123-owner",
                instanceID: "123",
                workspaceID: "foo-bar-123",
            });
        }).not.to.throw;
    }
}
module.exports = new TestRedisPublisher();
