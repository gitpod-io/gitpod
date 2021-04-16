/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { Disposable } from "@theia/core";

@injectable()
export class GitHubAnimationFrame {

    protected readonly animations: (() => void)[] = [];

    schedule(animation: () => void): Disposable {
        this.animations.push(animation);
        this.request();
        return Disposable.create(() => {
            const index = this.animations.indexOf(animation);
            if (index !== -1) {
                this.animations.splice(index, 1);
            }
        });
    }

    protected requested = false;
    protected request(): void {
        if (!this.shouldRequest()) {
            return;
        }
        this.requested = true;
        window.requestAnimationFrame(() => {
            this.requested = false;
            for (const animation of this.animations) {
                animation();
            }
            this.request();
        });
    }
    protected shouldRequest(): boolean {
        return !this.requested && this.animations.length !== 0;
    }

}