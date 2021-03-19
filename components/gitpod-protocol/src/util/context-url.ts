/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/**
 * The field "contextUrl" might contain prefixes like:
 *  - envvar1=value1/...
 *  - prebuild/...
 * This is the analogon to the (Prefix)ContextParser structure in "server".
 */
export function contextUrlToUrl(contextUrl: string | undefined): URL | undefined {
  if (contextUrl === undefined) {
    return undefined;
  }
  
  if (contextUrl.startsWith("http")) {
    return new URL(contextUrl);
  }
  const finding = contextUrl.search("/http");
  return new URL(contextUrl.substr(finding + 1));
}