/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { EventIterator } from "event-iterator";
import { Queue } from "event-iterator/lib/event-iterator";
import { ApplicationError, ErrorCodes } from "./messaging/error";

/**
 * Generates an asynchronous generator that yields values based on the provided setup function.
 *
 * the setup function that takes a queue and returns a cleanup function.
 * `queue.next` method that accepts a value to be pushed to the generator.
 *
 * remember that setup callback MUST wrap with try catch and use `queue.fail` to propagate error
 *
 * Iterator will always at least end with throw an `Abort error`
 */
export function generateAsyncGenerator<T>(
    setup: (queue: Queue<T>) => (() => void) | void,
    opts: { signal: AbortSignal },
) {
    return new EventIterator<T>((queue) => {
        opts.signal.addEventListener("abort", () => {
            queue.fail(new ApplicationError(ErrorCodes.CANCELLED, "cancelled"));
        });
        const dispose = setup(queue);
        return () => {
            if (dispose) {
                dispose();
            }
        };
    });
}
