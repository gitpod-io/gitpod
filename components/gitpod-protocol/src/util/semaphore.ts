/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


export class Semaphore {
    protected queue: (() => void)[] = [];
    protected used: number;

    constructor(protected readonly capacity: number) {
        if(capacity < 1) {
            throw new Error("Capacity cannot be less than 1");
        }
    }

    public release() {
        if(this.used == 0) return;

        const queued = this.queue.shift();
        if (queued) {
            queued();
        }

        this.used--;
    }

    public async acquire(): Promise<void> {
        this.used++;
        if(this.used <= this.capacity) {
            return Promise.resolve();
        }

        return new Promise<void>((rs, rj) => {
            this.queue.push(rs);
        });
    }

}