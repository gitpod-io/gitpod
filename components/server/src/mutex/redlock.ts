/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { Config } from "../config";
import { Redis as RedisClient } from "ioredis";
import Redlock from "redlock";

@injectable()
export class RedisMutex {
    @inject(Config) protected config: Config;

    public client(): Redlock {
        const redis = new RedisClient({
            host: this.config.redis.address,
            enableReadyCheck: true,
        });
        return new Redlock([redis], {
            // The expected clock drift; for more details see:
            // http://redis.io/topics/distlock
            driftFactor: 0.01, // multiplied by lock ttl to determine drift time

            // The max number of times Redlock will attempt to lock a resource
            // before erroring.
            retryCount: 3,

            // the time in ms between attempts
            retryDelay: 200, // time in ms

            // the max time in ms randomly added to retries
            // to improve performance under high contention
            // see https://www.awsarchitectureblog.com/2015/03/backoff.html
            retryJitter: 200, // time in ms

            // The minimum remaining time on a lock before an extension is automatically
            // attempted with the `using` API.
            automaticExtensionThreshold: 1 * 1000, // time in ms
        });
    }
}
