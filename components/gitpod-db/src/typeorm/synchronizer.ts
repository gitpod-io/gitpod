/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { TypeORM } from "./typeorm";

@injectable()
export class Synchronizer {
    @inject(TypeORM) protected typeORM: TypeORM;

    private semaphore = new Semaphore(5);

    /**
     * runs the given function with a distributed lock based on mysql's GET_LOCK
     */
    async synchronized<T>(lockKey: string, component: string, fn: () => Promise<T>): Promise<T> {
        // we use a query runner because that will use the same connection exclusively.
        // GET_LOCK is per connection, so we need to make sure we're using the same connection
        // note that calling this method will block the connection for the duration of the function, so if we exceed the pool with lots of concurrent calls, we'll run into trouble
        const before = new Date().getTime();
        await this.semaphore.acquire();
        const conn = (await this.typeORM.getConnection()).createQueryRunner();
        try {
            // this obtains and holds a dedicated db connection
            await conn.connect();
            const [lockResult] = await conn.query("SELECT get_lock(?,10) as lock_status", [lockKey]);
            if (lockResult.lock_status !== "1") {
                throw new Error(
                    "Failed to acquire lock - lock status: " +
                        lockResult.lock_status +
                        " - lock key: " +
                        lockKey +
                        " - component: " +
                        component +
                        " - time: " +
                        (new Date().getTime() - before) +
                        "ms",
                );
            }
            const result = await fn();
            return result;
        } finally {
            const [result] = await conn.query("SELECT RELEASE_LOCK(?) as lock_status", [lockKey]);
            if (result.lock_status !== "1") {
                log.error("failed to release lock", result);
            }
            try {
                await conn.release();
            } catch (error) {
                log.error("failed to release db connection", error);
            }
            this.semaphore.release();
        }
    }
}

class Semaphore {
    private semaphore: number;
    private queue: Array<Deferred<void>>;

    constructor(semaphore: number) {
        this.semaphore = semaphore;
        this.queue = [];
    }

    async acquire(): Promise<void> {
        if (this.semaphore > 0) {
            this.semaphore--;
            return;
        }

        const queueItem = new Deferred<void>();
        this.queue.push(queueItem);
        return queueItem.promise;
    }

    release(): void {
        if (this.queue.length > 0) {
            this.queue.shift()?.resolve();
        } else {
            this.semaphore++;
        }
    }
}
