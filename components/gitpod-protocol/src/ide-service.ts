/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Event } from "./util/event";

export type IDEState = 'init' | 'ready' | 'terminated';

export interface IDEService {
    readonly state: IDEState;
    readonly onDidChange: Event<void>;
}