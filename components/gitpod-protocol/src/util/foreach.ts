/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export async function asyncForEach<T>(it: IterableIterator<T>, callback: (t: T) => void, maxPerTick: number = 100): Promise<void> {
    return new Promise(resolve => {
        const iterate = () => {
            let i = 0;
            while (i < maxPerTick) {
                const v = it.next();
                if (v.done) {
                    resolve();
                    return;
                }
                callback(v.value);
                i++;
            }
            setImmediate(iterate);
        };
        iterate();
    });
}