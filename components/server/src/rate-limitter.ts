/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { Redis } from "ioredis";
import { IRateLimiterOptions, RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";

@injectable()
export class RateLimitter {
    constructor(@inject(Redis) private readonly redis: Redis) {}

    public async consume(key: string, options: IRateLimiterOptions): Promise<void> {
        await this.getRateLimitter(options).consume(key);
    }

    private readonly rateLimiters = new Map<string, RateLimiterRedis>();
    private getRateLimitter(options: IRateLimiterOptions): RateLimiterRedis {
        const sortedKeys = Object.keys(options).sort();
        const sortedObject: { [key: string]: any } = {};
        for (const key of sortedKeys) {
            sortedObject[key] = options[key as keyof IRateLimiterOptions];
        }
        const key = JSON.stringify(sortedObject);

        let rateLimiter = this.rateLimiters.get(key);
        if (!rateLimiter) {
            rateLimiter = new RateLimiterRedis({
                storeClient: this.redis,
                ...options,
                insuranceLimiter: new RateLimiterMemory(options),
            });
            this.rateLimiters.set(key, rateLimiter);
        }
        return rateLimiter;
    }
}
