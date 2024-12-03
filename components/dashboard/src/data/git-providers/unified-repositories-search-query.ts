/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SuggestedRepository } from "@gitpod/public-api/lib/gitpod/v1/scm_pb";
import { useSearchRepositories } from "./search-repositories-query";
import { useSuggestedRepositories } from "./suggested-repositories-query";
import { useMemo } from "react";
import { useListConfigurations } from "../configurations/configuration-queries";
import type { UseInfiniteQueryResult } from "@tanstack/react-query";
import { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { parseUrl } from "../../utils";

export const flattenPagedConfigurations = (
    data: UseInfiniteQueryResult<{ configurations: Configuration[] }>["data"],
): Configuration[] => {
    return data?.pages.flatMap((p) => p.configurations) ?? [];
};

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
    // 1st data source: suggested SCM repos + up to 100 imported repos.
    // todo(ft): look into deduplicating and merging these on the server
    const suggestedQuery = useSuggestedRepositories({ excludeConfigurations });
    const searchLimit = 30;
    // 2nd data source: SCM repos according to `searchString`
    const searchQuery = useSearchRepositories({ searchString, limit: searchLimit });
    // 3rd data source: imported repos according to `searchString`
    const configurationSearch = useListConfigurations({
        sortBy: "name",
        sortOrder: "desc",
        pageSize: searchLimit,
        searchTerm: searchString,
    });
    const flattenedConfigurations = useMemo(() => {
        if (excludeConfigurations) {
            return [];
        }

        const flattened = flattenPagedConfigurations(configurationSearch.data);
        return flattened.map(
            (repo) =>
                new SuggestedRepository({
                    configurationId: repo.id,
                    configurationName: repo.name,
                    url: repo.cloneUrl,
                }),
        );
    }, [configurationSearch.data, excludeConfigurations]);

    const filteredRepos = useMemo(() => {
        const repos = [suggestedQuery.data || [], flattenedConfigurations ?? [], searchQuery.data || []].flat();
        return deduplicateAndFilterRepositories(searchString, excludeConfigurations, onlyConfigurations, repos);
    }, [
        searchString,
        suggestedQuery.data,
        searchQuery.data,
        flattenedConfigurations,
        excludeConfigurations,
        onlyConfigurations,
    ]);

    return {
        data: filteredRepos,
        hasMore: (searchQuery.data?.length ?? 0) >= searchLimit,
        isLoading: suggestedQuery.isLoading,
        isSearching: searchQuery.isFetching,
        isError: suggestedQuery.isError || searchQuery.isError || configurationSearch.isError,
        error: suggestedQuery.error || searchQuery.error || configurationSearch.error,
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
        // normalize URLs
        if (repo.url.endsWith(".git")) {
            repo.url = repo.url.slice(0, -4);
        }

        // filter out configuration-less entries if an entry with a configuration exists, and we're not excluding configurations
        if (!repo.configurationId) {
            if (reposWithConfiguration.has(repo.url) || onlyConfigurations) {
                continue;
            }
        }

        // filter out entries that don't match the search string
        if (!`${repo.url}${repo.configurationName ?? ""}`.toLowerCase().includes(searchString.trim().toLowerCase())) {
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
        // If the searchString is a URL, and it's not present in the proposed results, "artificially" add it here.
        if (isValidGitUrl(searchString)) {
            results.push(
                new SuggestedRepository({
                    url: searchString,
                }),
            );
        }
    }

    // Limit what we show to 200 results
    return results.slice(0, 200);
}

const ALLOWED_GIT_PROTOCOLS = ["ssh:", "git:", "http:", "https:"];
/**
 * An opinionated git URL validator
 *
 * Assumptions:
 * - Git hosts are not themselves TLDs (like .com) or reserved names like `localhost`
 * - Git clone URLs can operate over ssh://, git:// and http(s)://
 * - Git clone URLs (both SSH and HTTP ones) must have a nonempty path
 */
export const isValidGitUrl = (input: string): boolean => {
    const url = parseUrl(input);
    if (!url) {
        // SSH URLs with no protocol, such as git@github.com:gitpod-io/gitpod.git
        const sshMatch = input.match(/^\w+@([^:]+):(.+)$/);
        if (!sshMatch) return false;

        const [, host, path] = sshMatch;

        // Check if the path is not empty
        if (!path || path.trim().length === 0) return false;

        if (path.includes(":")) return false;

        return isHostValid(host);
    }

    if (!url) return false;

    if (!ALLOWED_GIT_PROTOCOLS.includes(url.protocol)) return false;
    if (url.pathname.length <= 1) return false; // make sure we have some path

    return isHostValid(url.host);
};

const isHostValid = (input?: string): boolean => {
    if (!input) return false;

    const hostSegments = input.split(".");
    if (hostSegments.length < 2 || hostSegments.some((chunk) => chunk === "")) return false; // check that there are no consecutive periods as well as no leading or trailing ones

    return true;
};
