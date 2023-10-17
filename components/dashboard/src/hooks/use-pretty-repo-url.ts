/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export const usePrettyRepoURL = (url: string) => {
    return url.endsWith(".git") ? url.slice(0, -4) : url;
};
