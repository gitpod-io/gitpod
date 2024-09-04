/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/**
 * A resettable timeout, based on an AbortController + setTimeout.
 */
export class Timeout {
    private _timer: NodeJS.Timeout | undefined;
    private _abortController: AbortController | undefined;

    constructor(readonly timeout: number, readonly abortCondition?: () => boolean) {}

    /**
     * Starts a new timeout (and clears the old one). Identical to `reset`.
     */
    public start() {
        this.reset();
    }

    /**
     * Starts a new timeout (and clears the old one).
     */
    public reset() {
        this.clear();

        const abortController = new AbortController();
        this._abortController = abortController;
        this._timer = setTimeout(() => {
            if (this.abortCondition && this.abortCondition()) {
                return;
            }

            abortController.abort();
        }, this.timeout);
    }

    public clear() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = undefined;
        }
        if (this._abortController) {
            this._abortController = undefined;
        }
    }

    public signal(): AbortSignal | undefined {
        return this._abortController?.signal;
    }
}

export class CombinedAbortSignal extends AbortSignal {}
