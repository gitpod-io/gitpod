/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SuggestedRepository } from "@gitpod/gitpod-protocol";

const PRIORITY_LOW = 1;
const PRIORITY_MEDIUM = 2;
const PRIORITY_HIGH = 5;

export type SuggestedRepositoryWithSorting = SuggestedRepository & {
    priority: number;
    lastUse?: string;
};

export const sortSuggestedRepositories = (repos: SuggestedRepositoryWithSorting[]) => {
    // First we need to make a unique list and merge properties for entries with the same repo url
    // This allows us to consider the lastUse of a recently used project when sorting
    // as it will may have an entry for the project (no lastUse), and another for recent workspaces (w/ lastUse)
    const uniqueRepositories = new Map<string, SuggestedRepositoryWithSorting>();
    for (const repo of repos) {
        const existingRepo = uniqueRepositories.get(repo.url);

        const mergedEntry = {
            ...(existingRepo || repo),
            priority: existingRepo?.priority === undefined ? repo.priority : existingRepo.priority + repo.priority,
            lastUse: existingRepo?.lastUse || repo.lastUse,
            repositoryName: existingRepo?.repositoryName || repo.repositoryName,
        };

        uniqueRepositories.set(repo.url, mergedEntry);
    }

    const sortedRepos = Array.from(uniqueRepositories.values()).sort((a, b) => {
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

    return sortedRepos;
};

export const suggestionFromProject = (repo: SuggestedRepository): SuggestedRepositoryWithSorting => {
    return {
        ...repo,
        priority: PRIORITY_LOW,
    };
};

export const suggestionFromUserRepo = (repo: SuggestedRepository): SuggestedRepositoryWithSorting => {
    return {
        ...repo,
        priority: PRIORITY_MEDIUM,
    };
};

export const suggestionFromRecentWorkspace = (
    repo: SuggestedRepository,
    lastUse?: string,
): SuggestedRepositoryWithSorting => {
    return {
        ...repo,
        priority: PRIORITY_HIGH,
        lastUse,
    };
};
