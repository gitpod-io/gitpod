/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SuggestedRepository } from "@gitpod/gitpod-protocol";
import { useSearchRepositories } from "./search-repositories-query";
import { useSuggestedRepositories } from "./suggested-repositories-query";
import { useMemo } from "react";

type UnifiedRepositorySearchArgs = {
    searchString: string;
    // If true, excludes projects and only shows 1 entry per repo
    excludeProjects?: boolean;
};
// Combines the suggested repositories and the search repositories query into one hook
export const useUnifiedRepositorySearch = ({ searchString, excludeProjects = false }: UnifiedRepositorySearchArgs) => {
    const suggestedQuery = useSuggestedRepositories();
    const searchQuery = useSearchRepositories({ searchString });

    const filteredRepos = useMemo(() => {
        const flattenedRepos = [suggestedQuery.data || [], searchQuery.data || []].flat();
        return deduplicateAndFilterRepositories(searchString, excludeProjects, flattenedRepos);
    }, [excludeProjects, searchQuery.data, searchString, suggestedQuery.data]);

    return {
        data: filteredRepos,
        isLoading: suggestedQuery.isLoading,
        isSearching: searchQuery.isFetching,
        isError: suggestedQuery.isError || searchQuery.isError,
        error: suggestedQuery.error || searchQuery.error,
    };
};

export function deduplicateAndFilterRepositories(
    searchString: string,
    excludeProjects = false,
    suggestedRepos: SuggestedRepository[],
): SuggestedRepository[] {
    const normalizedSearchString = searchString.trim().toLowerCase();
    const collected = new Set<string>();
    const results: SuggestedRepository[] = [];
    const reposWithProject = new Set<string>();
    if (!excludeProjects) {
        suggestedRepos.forEach((r) => {
            if (r.projectId) {
                reposWithProject.add(r.url);
            }
        });
    }
    for (const repo of suggestedRepos) {
        // filter out project entries if excludeProjects is true
        if (repo.projectId && excludeProjects) {
            continue;
        }
        // filter out project-less entries if an entry with a project exists
        if (!repo.projectId && reposWithProject.has(repo.url)) {
            continue;
        }
        // filter out entries that don't match the search string
        if (!`${repo.url}${repo.projectName || ""}`.toLowerCase().includes(normalizedSearchString)) {
            continue;
        }
        // filter out duplicates
        const key = `${repo.url}:${repo.projectId || "no-project"}`;
        if (collected.has(key)) {
            continue;
        }
        collected.add(key);
        results.push(repo);
    }

    if (results.length === 0) {
        try {
            // If the normalizedSearchString is a URL, and it's not present in the proposed results, "artificially" add it here.
            new URL(normalizedSearchString);
            results.push({ url: normalizedSearchString });
        } catch {}
    }

    // Limit what we show to 200 results
    return results.slice(0, 200);
}
