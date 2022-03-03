/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Disposable } from '..';
import { log } from './logging';

/**
 * This intends to be a drop-in replacement for 'setInterval' implemented with a 'setTimeout' chain
 * to ensure we're not creating more timeouts than we can process.
 * @param op
 * @param everyMilliseconds
 * @returns
 */
export function repeat(op: () => Promise<void> | void, everyMilliseconds: number): Disposable {
    let timer: NodeJS.Timeout | undefined = undefined;
    let stopped = false;
    const repeated = () => {
        if (stopped) {
            // in case we missed the clearTimeout i 'await'
            return;
        }

        timer = setTimeout(async () => {
            try {
                await op();
            } catch (err) {
                // catch error here to
                log.error(err);
            }

            repeated(); // chain ourselves - after the 'await'
        }, everyMilliseconds);
    };
    repeated();

    return Disposable.create(() => {
        stopped = true;
        if (timer) {
            clearTimeout(timer);
        }
    });
}
