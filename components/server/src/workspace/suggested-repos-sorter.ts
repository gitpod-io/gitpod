/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SuggestedRepository } from "@gitpod/gitpod-protocol";

export const PRIORITY_LOW = 1;
export const PRIORITY_MEDIUM = 5;
export const PRIORITY_HIGH = 10;

export type SuggestedRepositoryWithSorting = SuggestedRepository & {
    priority: number;
    lastUse?: string;
};

export const sortSuggestedRepositories = (repos: SuggestedRepositoryWithSorting[]) => {
    const sortedRepos = repos.sort((a, b) => {
        // priority first
        if (a.priority !== b.priority) {
            return a.priority > b.priority ? -1 : 1;
        }
        // Most recently used second
        if (b.lastUse || a.lastUse) {
            const la = a.lastUse || "";
            const lb = b.lastUse || "";
            return la > lb ? -1 : la === lb ? 0 : 1;
        }
        // Otherwise, alphasort
        // We either use a name or the url
        const ua = (a.projectName || a.repositoryName || a.url).toLowerCase();
        const ub = (b.projectName || b.repositoryName || a.url).toLowerCase();
        return ua < ub ? -1 : ua === ub ? 0 : 1;
    });

    const uniqueRepositories = new Map<string, SuggestedRepositoryWithSorting>();

    for (const repo of sortedRepos) {
        const existingRepo = uniqueRepositories.get(repo.url);

        uniqueRepositories.set(repo.url, {
            ...(existingRepo || {}),
            ...repo,
        });
    }

    return Array.from(uniqueRepositories.values());
};
