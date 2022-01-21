/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export interface PollOptions<T> {
  backoffFactor: number;
  retryUntilSeconds: number;

  stop?: () => void;
  success: (result?: T) => void;

  token?: { cancelled?: boolean };
}

export const poll = async <T>(
  initialDelayInSeconds: number,
  callback: () => Promise<{ done: boolean; result?: T }>,
  opts: PollOptions<T>,
) => {
  const start = new Date();
  let delayInSeconds = initialDelayInSeconds;

  while (true) {
    const runSinceSeconds = (new Date().getTime() - start.getTime()) / 1000;
    if (runSinceSeconds > opts.retryUntilSeconds) {
      if (opts.stop) {
        opts.stop();
      }
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, delayInSeconds * 1000));
    if (opts.token?.cancelled) {
      return;
    }

    const { done, result } = await callback();
    if (opts.token?.cancelled) {
      return;
    }

    if (done) {
      opts.success(result);
      return;
    } else {
      delayInSeconds = opts.backoffFactor * delayInSeconds;
    }
  }
};
