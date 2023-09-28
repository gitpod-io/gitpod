/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useCurrentOrg } from "../organizations/orgs-query";
import { useDebounce } from "../../hooks/use-debounce";

export const useSearchRepositories = ({ searchString }: { searchString: string }) => {
    const { data: org } = useCurrentOrg();
    const debouncedSearchString = useDebounce(searchString);

    return useQuery(
        ["searchRepositories", { organizationId: org?.id || "", searchString: debouncedSearchString }],
        async () => {
            const result = await getGitpodService().server.searchRepositories({
                searchString,
                organizationId: org?.id ?? "",
            });
            return result;
        },
        {
            enabled: searchString.length >= 3 && !!org,
            // Need this to keep previous results while we wait for a new search to complete since debouncedSearchString changes and updates the key
            keepPreviousData: true,
            // We intentionally don't want to trigger refetches here
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
        },
    );
};
