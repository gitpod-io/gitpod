/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/**
 * A restartable timeout, based on an AbortController + setTimeout.
 *
 * Note: When cleared/reset, the AbortController is _NOT_ aborted.
 */
export class Timeout {
    private _timer: NodeJS.Timeout | undefined;
    private _abortController: AbortController | undefined;

    /**
     * @param timeout The timeout in milliseconds.
     * @param abortCondition An optional condition evaluated on timeout: If set, the abort is only emitted if it evaluates to true.
     */
    constructor(readonly timeout: number, readonly abortCondition?: () => boolean) {}

    /**
     * Starts a new timeout (and clears the old one). Identical to `reset`.
     */
    public start() {
        this.restart();
    }

    /**
     * Starts a new timeout (and clears the old one).
     */
    public restart() {
        this.clear();

        const abortController = new AbortController();
        this._abortController = abortController;
        if (this.timeout === Infinity) {
            return;
        }
        this._timer = setTimeout(() => {
            if (this.abortCondition && !this.abortCondition()) {
                return;
            }

            abortController.abort();
        }, this.timeout);
    }

    /**
     * Clears the current timeout.
     */
    public clear() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = undefined;
        }
        if (this._abortController) {
            this._abortController = undefined;
        }
    }

    /**
     * Convenience method to await the timeout.
     * @returns
     */
    public async await(): Promise<boolean> {
        const abortController = this._abortController;
        if (!abortController) {
            return false;
        }

        return new Promise((resolve) => {
            abortController.signal.addEventListener("abort", () => resolve(true));
        });
    }

    /**
     * @returns The AbortSignal of the current timeout, if one is active.
     */
    get signal() {
        return this._abortController?.signal;
    }
}
