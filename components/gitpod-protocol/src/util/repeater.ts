/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Deferred } from "./deferred";
import { log } from './logging';

/**
 * Repeats a given function until it is stopped
 */
export class Repeater {
    protected shouldRun: boolean;
    protected finished: Deferred<void>
    protected timer?: any;

    constructor(protected readonly fn: () => Promise<void> | void, protected readonly timeout: number) { }

    async start() {
        this.run();
    }

    async run() {
        this.shouldRun = true;
        this.finished = new Deferred<void>();
        while (this.shouldRun) {
            try {
                await this.fn();
            } catch (err) {
                log.error(err);
            }
            await this.sleep(this.timeout);
        }
        this.finished.resolve();
    }

    protected async sleep(timeout: number) {
        return new Promise(resolve => this.timer = setTimeout(resolve, timeout));
    }

    async stop() {
        this.shouldRun = false;
        if (this.timer) {
            clearTimeout(this.timer);
        }
        return this.finished.promise;
    }
}
