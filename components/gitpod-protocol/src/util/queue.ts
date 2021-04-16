/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Deferred } from "./deferred";

/**
 * Queues asynchronous operations in a synchronous context
 */
export class Queue {
    protected queue: Promise<any> = Promise.resolve();

    enqueue<T>(operation: () => Promise<T>): Promise<T> {
        const enqueue = new Deferred<T>();
        this.queue = this.queue.then(async () => {
            try {
                const result = await operation();
                enqueue.resolve(result);
            } catch (err) {
                enqueue.reject(err);
            }
        });
        return enqueue.promise;
    }
}
