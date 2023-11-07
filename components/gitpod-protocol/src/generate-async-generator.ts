/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

type Sink<T> = {
    next: (value: T | void) => void;
};

/**
 * Generates an asynchronous generator that yields values based on the provided setup function.
 *
 * the setup function that takes a sink and returns a cleanup function.
 * setup sink object has a `next` method that accepts a value to be pushed to the generator.
 */
export async function* generateAsyncGenerator<T>(
    setup: (sink: Sink<T>) => () => void,
    opts: { signal: AbortSignal },
): AsyncGenerator<T | void, void, unknown> {
    const queue: T[] = [];

    let resolveNext: ((value: T | void) => void) | null = null;

    const sink: Sink<T> = {
        next: (value: T | void) => {
            if (resolveNext) {
                resolveNext(value);
                resolveNext = null;
            } else {
                if (value) {
                    queue.push(value);
                }
            }
        },
    };

    let isStopped = false;
    opts.signal.addEventListener("abort", () => {
        isStopped = true;
        sink.next();
    });

    const cleanup = setup(sink);

    try {
        while (!isStopped) {
            if (queue.length) {
                yield queue.shift();
            } else {
                yield new Promise<T | void>((resolve) => {
                    resolveNext = resolve;
                });
            }
        }
        // ignore error since code in `try` scope will not throw an error
        // unless caller use it.throw, then it will throw to itself
    } finally {
        cleanup();
    }
}
