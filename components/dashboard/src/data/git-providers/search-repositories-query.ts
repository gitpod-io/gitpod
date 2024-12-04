/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { useDebounce } from "../../hooks/use-debounce";
import { scmClient } from "../../service/public-api";

export const useSearchRepositories = ({ searchString, limit }: { searchString: string; limit: number }) => {
    // This disables the search behavior when flag is disabled
    const { data: org } = useCurrentOrg();
    const debouncedSearchString = useDebounce(searchString);

    return useQuery(
        ["search-repositories", { organizationId: org?.id || "", searchString: debouncedSearchString, limit }],
        async () => {
            const { repositories } = await scmClient.searchRepositories({
                searchString,
                limit,
            });
            return repositories;
        },
        {
            enabled: !!org && debouncedSearchString.trim().length > 0,
            // Need this to keep previous results while we wait for a new search to complete since debouncedSearchString changes and updates the key
            keepPreviousData: true,
            // We intentionally don't want to trigger refetches here to avoid a loading state side effect of focusing
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
        },
    );
};
