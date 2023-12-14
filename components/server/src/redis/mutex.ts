/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { Redis } from "ioredis";
import Redlock, { RedlockAbortSignal, ResourceLockedError, ExecutionError, Settings } from "redlock";

@injectable()
export class RedisMutex {
    @inject(Redis) protected redis: Redis;

    private client(): Redlock {
        return new Redlock([this.redis], {
            // The expected clock drift; for more details see:
            // http://redis.io/topics/distlock
            driftFactor: 0.01, // multiplied by lock ttl to determine drift time

            // The max number of times Redlock will attempt to lock a resource
            // before erroring.
            retryCount: 20,

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
        settings: Partial<Settings> = {},
    ): Promise<T> {
        return this.client().using(resources, duration, settings, routine);
    }

    public static isLockedError(err: any): boolean {
        return (
            err instanceof ResourceLockedError ||
            // Should be a ResourceLockedError as well, but is ExecutionError in v5.x: https://github.com/mike-marcacci/node-redlock/issues/168
            (err instanceof ExecutionError &&
                err.message.includes("unable to achieve a quorum during its retry window"))
        );
    }
}
