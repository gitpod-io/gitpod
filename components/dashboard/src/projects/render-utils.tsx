/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export function toRemoteURL(cloneURL: string) {
  return cloneURL.replace(/(^https:\/\/)|(\.git$)/g, '');
}

export function shortCommitMessage(message: string) {
  const firstLine = message.split('\n')[0];
  return firstLine.length > 50 ? firstLine.substring(0, 45) + ' …' : firstLine;
}
