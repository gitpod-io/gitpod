/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export class Deferred<T> {
    resolve: (value?: T) => void;
    reject: (err?: any) => void;
    isResolved: boolean = false;
    timer: NodeJS.Timer;

    constructor(timeout?: number) {
        if (timeout) {
            this.timer = setTimeout(() => this.reject(new Error(`Timeout of ${timeout} ms.`)), timeout);
        }
    }

    promise = new Promise<T>((resolve, reject) => {
        this.resolve = (o) => {
            this.isResolved = true;
            resolve(o as any);
            clearTimeout(this.timer);
        };
        this.reject = (e) => {
            reject(e);
            clearTimeout(this.timer);
        };
    });
}
