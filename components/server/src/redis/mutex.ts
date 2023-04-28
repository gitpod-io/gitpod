/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import Redlock, { ExecutionError, RedlockAbortSignal, ResourceLockedError } from "redlock";
import { RedisClient } from "./client";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class RedisMutex {
    @inject(RedisClient) protected redis: RedisClient;

    private client(): Redlock {
        return new Redlock([this.redis.get()], {
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

    public async using<T>(
        resources: string[],
        duration: number,
        routine: (signal: RedlockAbortSignal) => Promise<T>,
    ): Promise<T> {
        try {
            return this.client().using(resources, duration, routine);
        } catch (err) {
            if (err instanceof ExecutionError) {
                // Workaround for https://github.com/mike-marcacci/node-redlock/issues/168 and https://github.com/mike-marcacci/node-redlock/issues/169
                if (err.message.indexOf("unable to achieve a quorum during its retry window") >= 0) {
                    log.debug("wsgc: failed to acquire workspace-gc lock, another instance already has the lock", err);

                    throw new ResourceLockedError("operation was unable to achieve quorum");
                }
            }

            throw err;
        }
    }
}
