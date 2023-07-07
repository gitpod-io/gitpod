/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable, postConstruct } from "inversify";
import { Redis } from "ioredis";
import { Config } from "../config";

@injectable()
export class RedisClient {
    @inject(Config) protected config: Config;

    private client: Redis;

    @postConstruct()
    protected initialize(): void {
        const [host, port] = this.config.redis.address.split(":");
        this.client = new Redis({
            port: Number(port),
            host,
            enableReadyCheck: true,
            keepAlive: 10 * 1000,
            connectionName: "server",
        });
    }

    public get(): Redis {
        return this.client;
    }

    public new(connectionName: string): Redis {
        const [host, port] = this.config.redis.address.split(":");
        return new Redis({
            port: Number(port),
            host,
            enableReadyCheck: true,
            keepAlive: 10 * 1000,
            connectionName: connectionName,
        });
    }
}
