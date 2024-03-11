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

    const projectURLs: string[] = [];
    let uniqueRepositories: SuggestedRepositoryWithSorting[] = [];

    for (const repo of repos) {
        const sameURLEntries = uniqueRepositories.filter((r) => r.url === repo.url);

        // If this is a project look for non-project entries and merge in priority/lastUse
        if (repo.projectId && repo.projectName) {
            // keep track of any urls that have at least one project so we can filter out non-project entries later
            projectURLs.push(repo.url);
            const projectEntry = { ...repo };

            for (const entry of sameURLEntries) {
                // Don't consider other projects
                if (entry.projectId) {
                    continue;
                }

                // Add priority to project entry to bump it up
                projectEntry.priority += entry.priority;

                // Use the most recent lastUse entry for this url
                // TODO: once we track projectId on recent workspaces, we can avoid this
                if ((entry.lastUse ?? 0) > (projectEntry.lastUse ?? 0)) {
                    projectEntry.lastUse = entry.lastUse;
                }

                // Fill in the repositoryName if it's missing
                projectEntry.repositoryName = projectEntry.repositoryName || entry.repositoryName;
            }

            uniqueRepositories.push(projectEntry);
        } else {
            // If no entries exist for this url yet, just add it
            if (sameURLEntries.length === 0) {
                uniqueRepositories.push(repo);
                continue;
            }

            // Look for any projects for this url and update their priority/lastUse
            for (const entry of sameURLEntries) {
                if (!entry.projectId) {
                    continue;
                }

                entry.priority += repo.priority;
                if ((repo.lastUse ?? "") > (entry.lastUse ?? "")) {
                    entry.lastUse = repo.lastUse;
                }
            }
        }
    }

    // Filter out any non-projects that already have a project entry for their url
    uniqueRepositories = uniqueRepositories.filter((repo) => {
        // Keep any project entries
        if (repo.projectId) {
            return true;
        }
        // Exclude any non-projects that already have a project entry for their url
        if (projectURLs.includes(repo.url)) {
            return false;
        }

        return true;
    });

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
        priority: PRIORITY_MEDIUM,
    };
};

export const suggestionFromUserRepo = (repo: SuggestedRepository): SuggestedRepositoryWithSorting => {
    return {
        ...repo,
        priority: PRIORITY_LOW,
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
