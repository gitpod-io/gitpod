/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/// <reference types='@gitpod/gitpod-protocol/lib/typings/globals'/>

/**
* API specified by https://wicg.github.io/keyboard-map/
*/
interface Navigator {
    keyboard?: Keyboard;
}
interface Keyboard {
    getLayoutMap?(): Promise<Map<string, string>>;
    addEventListener?(type: 'layoutchange', listener: EventListenerOrEventListenerObject): void;
}