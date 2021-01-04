/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/**
 * The mini-browser can now serve content on its own host/origin.
 *
 * The virtual host can be configured with this `THEIA_MINI_BROWSER_HOST_PATTERN`
 * environment variable. `{{hostname}}` reprensents the current host, and `{{uuid}}`
 * will be replace by a random uuid value.
 */
export namespace MiniBrowserEndpoint {
    export const HOST_PATTERN_ENV = 'THEIA_MINI_BROWSER_HOST_PATTERN';
    export const HOST_PATTERN_DEFAULT = '{{uuid}}.mini-browser.{{hostname}}';
}
