/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

const REGEX_WORKSPACE_ID = /[0-9a-z]{2,16}-[0-9a-z]{2,16}-[0-9a-z]{8,11}/;
const REGEX_WORKSPACE_ID_EXACT = new RegExp(`^${REGEX_WORKSPACE_ID.source}$`);
// We need to parse the workspace id precisely here to get the case '<some-str>-<port>-<wsid>.ws.' right
const REGEX_WORKSPACE_ID_FROM_HOSTNAME = new RegExp(`(${REGEX_WORKSPACE_ID.source})\.ws`);

const REGEX_WORKSPACE_ID_LEGACY = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const REGEX_WORKSPACE_ID_LEGACY_EXACT = new RegExp(`^${REGEX_WORKSPACE_ID_LEGACY.source}$`);
const REGEX_WORKSPACE_ID_LEGACY_FROM_HOSTNAME = new RegExp(`(${REGEX_WORKSPACE_ID_LEGACY.source})\.ws`);

/**
 * Hostname may be of the form:
 *  - moccasin-ferret-155799b3.ws-eu01.gitpod.io
 *  - 1234-moccasin-ferret-155799b3.ws-eu01.gitpod.io
 *  - webview-1234-moccasin-ferret-155799b3.ws-eu01.gitpod.io (or any other string replacing webview)
 * @param hostname The hostname the request is headed to
 */
export const parseWorkspaceIdFromHostname = function (hostname: string) {
  const match = REGEX_WORKSPACE_ID_FROM_HOSTNAME.exec(hostname);
  if (match && match.length >= 2) {
    return match[1];
  } else {
    const legacyMatch = REGEX_WORKSPACE_ID_LEGACY_FROM_HOSTNAME.exec(hostname);
    if (legacyMatch && legacyMatch.length >= 2) {
      return legacyMatch[1];
    }
    return undefined;
  }
};

/** Equalls UUIDv4 (and REGEX_WORKSPACE_ID_LEGACY!) */
const REGEX_INSTANCE_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const REGEX_INSTANCE_ID_EXACT = new RegExp(`^${REGEX_INSTANCE_ID.source}$`);

/**
 * @param maybeId
 * @returns
 */
export const matchesInstanceIdOrLegacyWorkspaceIdExactly = function (maybeId: string): boolean {
  return REGEX_INSTANCE_ID_EXACT.test(maybeId) || REGEX_WORKSPACE_ID_LEGACY_EXACT.test(maybeId);
};

/**
 * @param maybeWorkspaceId
 * @returns
 */
export const matchesNewWorkspaceIdExactly = function (maybeWorkspaceId: string): boolean {
  return REGEX_WORKSPACE_ID_EXACT.test(maybeWorkspaceId);
};
