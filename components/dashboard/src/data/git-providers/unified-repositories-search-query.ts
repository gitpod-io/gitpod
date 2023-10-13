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
        const repoMap = new Map<string, SuggestedRepository>();
        // combine & flatten suggestions and search results, then merge them into a map
        const flattenedRepos = [suggestedQuery.data || [], searchQuery.data || []].flat();

        for (const repo of flattenedRepos) {
            const key = excludeProjects ? repo.url : `${repo.url}:${repo.projectId || ""}`;

            const newEntry = {
                ...(repoMap.get(key) || {}),
                ...repo,
            };
            if (excludeProjects) {
                // TODO: would be great if we can always include repositoryName on SuggestedRepository entities, then we could remove this
                newEntry.repositoryName = newEntry.repositoryName || newEntry.projectName;
                newEntry.projectName = undefined;
            }
            repoMap.set(key, newEntry);
        }

        return filterRepos(searchString, Array.from(repoMap.values()));
    }, [excludeProjects, searchQuery.data, searchString, suggestedQuery.data]);

    return {
        data: filteredRepos,
        isLoading: suggestedQuery.isLoading,
        isSearching: searchQuery.isFetching,
        isError: suggestedQuery.isError || searchQuery.isError,
        error: suggestedQuery.error || searchQuery.error,
    };
};

export const filterRepos = (searchString: string, suggestedRepos: SuggestedRepository[]) => {
    let results = suggestedRepos;
    const normalizedSearchString = searchString.trim().toLowerCase();

    if (normalizedSearchString.length > 1) {
        results = suggestedRepos.filter((r) => {
            return `${r.url}${r.projectName || ""}`.toLowerCase().includes(normalizedSearchString);
        });

        if (results.length === 0) {
            try {
                // If the normalizedSearchString is a URL, and it's not present in the proposed results, "artificially" add it here.
                new URL(normalizedSearchString);
                results.push({ url: normalizedSearchString });
            } catch {}
        }
    }

    // Limit what we show to 200 results
    return results.length > 200 ? results.slice(0, 200) : results;
};
