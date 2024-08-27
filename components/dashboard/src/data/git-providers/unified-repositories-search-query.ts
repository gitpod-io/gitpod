/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SuggestedRepository } from "@gitpod/public-api/lib/gitpod/v1/scm_pb";
import { useSearchRepositories } from "./search-repositories-query";
import { useSuggestedRepositories } from "./suggested-repositories-query";
import { PREDEFINED_REPOS } from "./predefined-repos";
import { useMemo } from "react";
import { useListConfigurations } from "../configurations/configuration-queries";

type UnifiedRepositorySearchArgs = {
    searchString: string;
    // If true, excludes configurations and only shows 1 entry per repo
    excludeConfigurations?: boolean;
    // If true, only shows entries with a corresponding configuration
    onlyConfigurations?: boolean;
    // If true, only shows example repositories
    showExamples?: boolean;
    selectedContextURL?: string;
    selectedConfigurationId?: string;
};
// Combines the suggested repositories and the search repositories query into one hook
export const useUnifiedRepositorySearch = ({
    searchString,
    excludeConfigurations = false,
    onlyConfigurations = false,
    showExamples = false,
    selectedContextURL,
    selectedConfigurationId,
}: UnifiedRepositorySearchArgs) => {
    const suggestedQuery = useSuggestedRepositories({ excludeConfigurations });
    const searchLimit = 30;
    const searchQuery = useSearchRepositories({ searchString, limit: searchLimit });
    const configurationSearch = useListConfigurations({
        sortBy: "name",
        sortOrder: "desc",
        pageSize: searchLimit,
        searchTerm: searchString,
    });
    const flattenedConfigurations = useMemo(
        () =>
            (configurationSearch.data?.pages.flatMap((p) => p.configurations) ?? []).map(
                (repo) =>
                    new SuggestedRepository({
                        configurationId: repo.id,
                        configurationName: repo.name,
                        url: repo.cloneUrl,
                    }),
            ),
        [configurationSearch.data],
    );
    const selectedItemSearch = useListConfigurations({
        sortBy: "name",
        sortOrder: "desc",
        pageSize: searchLimit,
        searchTerm: selectedConfigurationId ?? selectedContextURL,
    });
    const flattenedSelectedItem = useMemo(
        () =>
            (selectedItemSearch.data?.pages.flatMap((p) => p.configurations) ?? []).map(
                (repo) =>
                    new SuggestedRepository({
                        configurationId: repo.id,
                        configurationName: repo.name,
                        url: repo.cloneUrl,
                    }),
            ),
        [selectedItemSearch.data],
    );

    const filteredRepos = useMemo(() => {
        if (showExamples && searchString.length === 0) {
            return PREDEFINED_REPOS.map(
                (repo) =>
                    new SuggestedRepository({
                        url: repo.url,
                        repoName: repo.repoName,
                    }),
            );
        }

        const repos = [
            suggestedQuery.data || [],
            searchQuery.data || [],
            flattenedConfigurations ?? [],
            flattenedSelectedItem ?? [],
        ].flat();
        console.log(deduplicateAndFilterRepositories(searchString, excludeConfigurations, onlyConfigurations, repos));
        return deduplicateAndFilterRepositories(searchString, excludeConfigurations, onlyConfigurations, repos);
    }, [
        showExamples,
        searchString,
        suggestedQuery.data,
        searchQuery.data,
        flattenedConfigurations,
        flattenedSelectedItem,
        excludeConfigurations,
        onlyConfigurations,
    ]);

    return {
        data: filteredRepos,
        hasMore: (searchQuery.data?.length ?? 0) >= searchLimit,
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
        if (!`${repo.url}${repo.configurationName || ""}`.toLowerCase().includes(searchString.trim().toLowerCase())) {
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
            // If the searchString is a URL, and it's not present in the proposed results, "artificially" add it here.
            new URL(searchString);
            results.push(
                new SuggestedRepository({
                    url: searchString,
                }),
            );
        } catch {}
    }

    // Limit what we show to 200 results
    return results.slice(0, 200);
}
