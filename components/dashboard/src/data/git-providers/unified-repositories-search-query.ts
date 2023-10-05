/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SuggestedRepository } from "@gitpod/gitpod-protocol";
import { useSearchRepositories } from "./search-repositories-query";
import { useSuggestedRepositories } from "./suggested-repositories-query";
import { useMemo } from "react";

// Combines the suggested repositories and the search repositories query into one hook
export const useUnifiedRepositorySearch = ({ searchString }: { searchString: string }) => {
    const suggestedQuery = useSuggestedRepositories();
    const searchQuery = useSearchRepositories({ searchString });

    const filteredRepos = useMemo(() => {
        const repoMap = new Map<string, SuggestedRepository>(
            (suggestedQuery.data || []).map((r) => [`${r.url}:${r.projectId || ""}`, r]),
        );

        // Merge the search results into the suggested results
        for (const repo of searchQuery.data || []) {
            const key = `${repo.url}:${repo.projectId || ""}`;

            if (!repoMap.has(key)) {
                repoMap.set(key, repo);
            }
        }

        return filterRepos(searchString, Array.from(repoMap.values()));
    }, [searchQuery.data, searchString, suggestedQuery.data]);

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
