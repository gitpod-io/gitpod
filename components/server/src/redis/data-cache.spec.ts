/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { suite, test } from "@testdeck/mocha";
import { DataCacheRedis } from "./data-cache";
import * as IORedis from "ioredis";

const Redis = require("ioredis-mock");
const expect = chai.expect;
const client: IORedis.Redis = new Redis();

class DataCacheRedisMock extends DataCacheRedis {
    constructor() {
        super();
        this.redis = client as any;
    }
}

@suite
export class RedisClientSpec {
    @test public async testGet() {
        const redisClient = new DataCacheRedisMock();

        expect(await redisClient.get("foo:bar", () => Promise.resolve("A"))).to.eq("A");
        expect(await redisClient.get("foo:bar", () => Promise.resolve("B"))).to.eq("A");

        await redisClient.invalidate("foo:bar");
        expect(await redisClient.get("foo:bar", () => Promise.resolve("C"))).to.eq("C");
        await redisClient.invalidate("foo:*");
        expect(await redisClient.get("foo:bar", () => Promise.resolve("D"))).to.eq("D");
    }
}
