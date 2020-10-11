/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Event } from "./util/event";
import { Disposable } from "./util/disposable";

export type IDEState = 'init' | 'ready' | 'terminated';

export interface IDEService {
    readonly state: IDEState;
    readonly onDidChange: Event<void>;
    /**
     * Starts the ide application.
     * Returns the disposable object which is triggered when the ide application should be stopped.
     *
     * On stop the application should store the unsaved changes.
     * It won't receive any `beforeunload` events from window anymore to prevent
     * confirmation dialogs for stopped workspaces.
     */
    start(): Disposable;
}