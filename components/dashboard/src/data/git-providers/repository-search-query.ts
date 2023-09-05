/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useProviderRepositoriesForUser } from "./provider-repositories-query";

export const useSuggestedContextContextURLs = () => {
    return useQuery(["suggested-context-urls"], async () => {
        return await getGitpodService().server.getSuggestedContextURLs();
    });
};

type UseRepositorySearchArgs = {
    search?: string;
};
export const useRepositorySearch = ({ search = "" }: UseRepositorySearchArgs) => {
    // irregarless of the search term, we always want to load the suggested context urls
    const {
        data: suggestedContextURLs,
        isLoading: isSuggestedLoading,
        error: suggestedError,
    } = useSuggestedContextContextURLs();

    // if suggested context urls doesn't have a match, we want to search git provider for a match
    const {
        data: searchResults,
        isLoading: isSearchLoading,
        error: searchError,
    } = useProviderRepositoriesForUser({
        search,
        // TODO: how should we check all providers?
        providerHost: "github.com",
        enabled: !!search,
    });

    let results: string[];
    const searchString = search.trim().toLowerCase();

    // If the search string is empty, return a chunk of the first suggested context URLs
    if (!searchString) {
        results = suggestedContextURLs || [];
    } else {
        const suggestedMatches = suggestedContextURLs?.filter((url) => url.toLowerCase().includes(searchString)) ?? [];

        const searchMatches = searchResults?.map((repo) => repo.cloneUrl) ?? [];

        results = [...suggestedMatches, ...searchMatches];

        // If there are no matches, and search string is a URL, "artificially" add it to the results.
        if (results.length === 0) {
            try {
                new URL(searchString);
                results.push(searchString);
            } catch {}
        }
    }

    return {
        data: results.length > 200 ? results.slice(0, 200) : results,
        isLoading: isSuggestedLoading || isSearchLoading,
        error: suggestedError || searchError,
    };
};
