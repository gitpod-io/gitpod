/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


export interface PollOptions<T> {
    backoffFactor: number;
    warningInSeconds: number;
    retryUntilSeconds: number;

    warn?: () => void;
    stop?: () => void;
    success: (result?: T) => void;
}
export namespace PollOptions {
    export const create = (success: () => void) => ({
        backoffFactor: 1.2,
        warningInSeconds: 40,
        retryUntilSeconds: 120,
    
        success
    });
}
export const poll = <T>(initialDelayInSeconds: number, callback: () => Promise<{done: boolean, result?: T}>, opts: PollOptions<T>) => {
    const start = new Date();
    doPoll(start, initialDelayInSeconds, callback, opts);
};

const doPoll = <T>(start: Date, delayInSeconds: number, callback: () => Promise<{done: boolean, result?: T}>, opts: PollOptions<T>) => {
    const runSinceSeconds = ((new Date().getTime()) - start.getTime()) / 1000;
    if (runSinceSeconds > opts.retryUntilSeconds) {
        if (opts.stop) {
            opts.stop();
        }
    } else {
        if (runSinceSeconds > opts.warningInSeconds) {
            if (opts.warn) {
                opts.warn();
            }
        }
        setTimeout(async () => {
            const { done, result } = await callback();
            if (done) {
                opts.success(result);
            } else {
                doPoll(start, opts.backoffFactor * delayInSeconds, callback, opts);
            }
            // tslint:disable-next-line:align
        }, delayInSeconds * 1000);
    }
};


export function globalCache<T>(name: string, creator: () => T): T {
    const key = '__gitpod_' + name;
    if (key in window) {
        return window[key];
    }
    const result = creator();
    window[key] = result;
    return result;
}