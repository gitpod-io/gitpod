/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import {
    reportRedisCacheRequest,
    redisCacheGetLatencyHistogram,
    redisCacheSetLatencyHistogram,
} from "../prometheus-metrics";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { DataCache } from "@gitpod/gitpod-db/lib/data-cache";
import { Redis } from "ioredis";

const TTL_SEC = 5 * 60; // 5 minutes

@injectable()
export class DataCacheRedis implements DataCache {
    @inject(Redis) protected redis: Redis;

    async get<T>(cacheKey: string, provider: () => Promise<T | undefined>): Promise<T | undefined> {
        const cache_group = cacheKey.split(":")[0];
        const stopGetTimer = redisCacheGetLatencyHistogram.startTimer({ cache_group });
        let result: string | null = null;
        try {
            result = await this.redis.getex(cacheKey, "EX", TTL_SEC);
        } catch (error) {
            log.error("Error retrieving cache value", error, { cacheKey });
        } finally {
            stopGetTimer();
        }
        reportRedisCacheRequest(result !== null);
        if (result) {
            return JSON.parse(result);
        } else {
            const value = await provider();
            if (value) {
                const stopSetTimer = redisCacheSetLatencyHistogram.startTimer({ cache_group });
                try {
                    await this.redis.set(cacheKey, JSON.stringify(value), "EX", TTL_SEC);
                } catch (error) {
                    log.error("Error while setting cache value", error, { cacheKey });
                } finally {
                    stopSetTimer();
                }
            }
            return value;
        }
    }

    async invalidate(cacheKeyPattern: string): Promise<void> {
        const keys = await this.redis.keys(cacheKeyPattern);
        if (keys.length > 0) {
            await this.redis.del(keys);
        }
    }
}
