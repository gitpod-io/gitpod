/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// Source: https://github.com/marteinn/The-Big-Username-Blacklist-JS/blob/master/src/index.js
declare module 'the-big-username-blacklist' {
    export function validate(username: string): boolean;
    export var list: string[];
}
