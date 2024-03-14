/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SuggestedRepository } from "@gitpod/public-api/lib/gitpod/v1/scm_pb";
import { useSearchRepositories } from "./search-repositories-query";
import { useSuggestedRepositories } from "./suggested-repositories-query";
import { useMemo } from "react";

type UnifiedRepositorySearchArgs = {
    searchString: string;
    // If true, excludes configurations and only shows 1 entry per repo
    excludeConfigurations?: boolean;
    // If true, only shows entries with a corresponding configuration
    onlyConfigurations?: boolean;
};
// Combines the suggested repositories and the search repositories query into one hook
export const useUnifiedRepositorySearch = ({
    searchString,
    excludeConfigurations = false,
    onlyConfigurations = false,
}: UnifiedRepositorySearchArgs) => {
    const suggestedQuery = useSuggestedRepositories({ excludeConfigurations });
    const searchLimit = 30;
    const searchQuery = useSearchRepositories({ searchString, limit: searchLimit });

    const filteredRepos = useMemo(() => {
        const flattenedRepos = [suggestedQuery.data || [], searchQuery.data || []].flat();

        return deduplicateAndFilterRepositories(
            searchString,
            excludeConfigurations,
            onlyConfigurations,
            flattenedRepos,
        );
    }, [excludeConfigurations, onlyConfigurations, searchQuery.data, searchString, suggestedQuery.data]);

    return {
        data: filteredRepos,
        hasMore: searchQuery.data?.length === searchLimit,
        isLoading: suggestedQuery.isLoading,
        isSearching: searchQuery.isFetching,
        isError: suggestedQuery.isError || searchQuery.isError,
        error: suggestedQuery.error || searchQuery.error,
    };
};

export function deduplicateAndFilterRepositories(
    searchString: string,
    excludeConfigurations = false,
    onlyConfigurations = false,
    suggestedRepos: SuggestedRepository[],
): SuggestedRepository[] {
    const normalizedSearchString = searchString.trim().toLowerCase();
    const collected = new Set<string>();
    const results: SuggestedRepository[] = [];
    const reposWithConfiguration = new Set<string>();
    if (!excludeConfigurations) {
        suggestedRepos.forEach((r) => {
            if (r.configurationId) {
                reposWithConfiguration.add(r.url);
            }
        });
    }
    for (const repo of suggestedRepos) {
        // filter out configuration-less entries if an entry with a configuration exists, and we're not excluding configurations
        if (!repo.configurationId) {
            if (reposWithConfiguration.has(repo.url) || onlyConfigurations) {
                continue;
            }
        }

        // filter out entries that don't match the search string
        if (!`${repo.url}${repo.configurationName || ""}`.toLowerCase().includes(normalizedSearchString)) {
            continue;
        }
        // filter out duplicates
        const key = `${repo.url}:${excludeConfigurations ? "" : repo.configurationId || "no-configuration"}`;
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
            results.push(
                new SuggestedRepository({
                    url: normalizedSearchString,
                }),
            );
        } catch {}
    }

    // Limit what we show to 200 results
    return results.slice(0, 200);
}
