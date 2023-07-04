/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";
import { RedisPublisher } from "./publisher";
import { Metrics } from "../metrics";
import { RedisClient } from "./client";
import { Container, ContainerModule } from "inversify";

const expect = chai.expect;
const Redis = require("ioredis-mock");

@suite
class TestRedisPublisher {
    protected container: Container;

    public before() {
        const client = {
            get: () => new Redis(),
        } as RedisClient;

        this.container = new Container();
        this.container.load(
            new ContainerModule((bind) => {
                bind(Metrics).toSelf().inSingletonScope();
                bind(RedisClient).toConstantValue(client);
                bind(RedisPublisher).toSelf().inSingletonScope();
            }),
        );
    }

    @test public publishInstanceUpdate() {
        const publisher = this.container.get(RedisPublisher);
        expect(() => {
            publisher.publishInstanceUpdate({
                instanceID: "123",
                workspaceID: "foo-bar-123",
            });
        }).not.to.throw;
    }
}
module.exports = new TestRedisPublisher();
