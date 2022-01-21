/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/**
 * These cookies are set in the Theia frontend. This pattern is relied upon in:
 *  - proxy:
 *    - to filter it out on port locations
 *    - to forward it to the server for authentication
 *  - server:
 *    - to authenticate access to port locations
 */
export const worspacePortAuthCookieName = function (host: string, workspaceId: string): string {
  return host.replace(/https?/, '').replace(/[\W_]+/g, '_') + `_ws_${workspaceId}_port_auth_`;
};
