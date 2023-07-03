/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, postConstruct } from "inversify";
import { Redis } from "ioredis";

@injectable()
export class RedisClient {
    private client: Redis;

    @postConstruct()
    protected initialize(): void {
        const [host, port] = "redis:6379".split(":");
        this.client = new Redis({
            port: Number(port),
            host,
            enableReadyCheck: true,
            keepAlive: 10 * 1000,
            connectionName: "ws-man-bridge",
        });
    }

    public get(): Redis {
        return this.client;
    }
}
