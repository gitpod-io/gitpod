/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Disposable } from "./disposable";

export class Cancelable<T> implements Disposable {
    protected canceled: boolean;

    constructor(protected readonly activity: (cancel: boolean) => Promise<T> | undefined) { }

    public async run(): Promise<T | undefined> {
        for(let r = await this.activity(this.canceled); ; r = await this.activity(this.canceled)) {
            if (this.canceled) {
                return;
            } else if (r !== undefined) {
                return r;
            }
        }
    }

    public cancel() {
        this.canceled = true;
    }

    dispose(): void {
        this.cancel();
    }
}