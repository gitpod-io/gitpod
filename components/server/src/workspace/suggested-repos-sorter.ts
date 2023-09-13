/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SuggestedRepository } from "@gitpod/gitpod-protocol";
import mergeWith from "lodash.mergewith";

export const PRIORITY_LOW = 1;
export const PRIORITY_MEDIUM = 5;
export const PRIORITY_HIGH = 10;

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

        // Only merge properties if the source doesn't already have a value for it
        const mergedEntry = mergeWith(existingRepo || {}, repo, (objValue, srcValue) => {
            return objValue === undefined ? srcValue : objValue;
        });

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
