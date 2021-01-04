/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Emitter } from "@theia/core/lib/common/event";
import { Deferred } from "@theia/core/lib/common/promise-util";
import { injectable } from "inversify";

@injectable()
export abstract class GitHosterExtension {

    protected readonly onStateChangedEmitter = new Emitter<GitHosterExtension.State>();
    readonly onStateChanged = this.onStateChangedEmitter.event;

    abstract readonly name: string;

    protected _initialized = new Deferred<void>();
    get initialized(): Promise<void> {
        return this._initialized.promise;
    }

    protected _enabled = false;
    get enabled(): boolean {
        return this._enabled;
    }
    protected _host = "";
    get host(): string {
        return this._host;
    }
    update(enabled: boolean, host: string) {
        this._initialized.resolve();
        if (this._enabled !== enabled && this._host !== host) {
            this._enabled = enabled;
            this._host = host;
            this.onStateChangedEmitter.fire({ enabled, host });
        }
    }
}

export namespace GitHosterExtension {

    export const CURRENT_HOSTER = Symbol("CURRENT_HOSTER");
    export const CURRENT_HOSTER_NAME = Symbol("CURRENT_HOSTER_NAME");

    export interface State {
        readonly enabled: boolean;
        readonly host: string;
    }
}
