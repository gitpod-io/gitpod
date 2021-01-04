/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitHubEndpoint } from "./github-endpoint";
import { Deferred } from "@theia/core/lib/common/promise-util";

export class BatchLoader {

    protected queue: {
        query: string
        acceptor: (result: any, error?: any) => void
    }[] = [];

    constructor(
        protected readonly endpoint: GitHubEndpoint
    ) { }

    batch<T>(query: string, acceptor: (result?: T, error?: any) => void): void {
        this.queue.push({ query, acceptor });
    }

    async load(): Promise<void> {
        while (this.queue.length !== 0) {
            await this.run();
        }
        this._done.resolve();
    }

    protected _done = new Deferred<void>();
    get done(): Promise<void> {
        return this._done.promise;
    }

    protected async run(): Promise<void> {
        const queue = this.queue;
        this.queue = [];
        const queryMap = new Map<string, string>();
        const acceptorMap = new Map<string, (result?: any, error?: any) => void>();
        let i = 0;
        for (const { query, acceptor } of queue) {
            const key = `__q${i++}`;
            queryMap.set(key, query);
            acceptorMap.set(key, acceptor);
        }
        const result = await this.endpoint.runBatch(queryMap);
        const { data, errors } = result;
        for (const key of queryMap.keys()) {
            const acceptor = acceptorMap.get(key)!;
            if (data && data[key]) {
                acceptor(data[key]);
                continue;
            }
            if (errors) {
                const error = errors.find(err => err.path && err.path.indexOf(key) >= 0);
                acceptor(undefined, error);
                continue;
            }
            console.warn(`Result is missing for query: ${queryMap.get(key)}`);
        }
    }

}
