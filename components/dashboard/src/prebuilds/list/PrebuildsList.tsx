/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useEffect, useMemo } from "react";
import { useHistory } from "react-router-dom";
import { PageHeading } from "@podkit/layout/PageHeading";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { useQueryParams } from "../../hooks/use-query-params";
import { PrebuildListEmptyState } from "./PrebuildEmptyListState";
import { useStateWithDebounce } from "../../hooks/use-state-with-debounce";
import { PrebuildsTable } from "./PrebuildsTable";
import { LoadingState } from "@podkit/loading/LoadingState";
import { useListOrganizationPrebuildsQuery } from "../../data/prebuilds/organization-prebuilds-query";

const PrebuildsListPage: FC = () => {
    useDocumentTitle("Prebuilds");

    const history = useHistory();

    const params = useQueryParams();
    const [searchTerm, setSearchTerm, searchTermDebounced] = useStateWithDebounce(params.get("search") || "");

    useEffect(() => {
        const params = new URLSearchParams();
        if (searchTermDebounced) {
            params.set("search", searchTermDebounced);
        }
        params.toString();
        history.replace({ search: `?${params.toString()}` });
    }, [history, searchTermDebounced]);

    // TODO: handle isError case
    const { data, isLoading, isFetching, isFetchingNextPage, isPreviousData, hasNextPage, fetchNextPage } =
        useListOrganizationPrebuildsQuery({
            filter: {
                searchTerm: searchTermDebounced,
            },
            pageSize: 30,
        });

    const prebuilds = useMemo(() => {
        return data?.pages.map((page) => page.prebuilds).flat() ?? [];
    }, [data?.pages]);

    const hasMoreThanOnePage = (data?.pages.length ?? 0) > 1;

    // This tracks any filters/search params applied
    const hasFilters = !!searchTermDebounced;

    // Show the table once we're done loading and either have results, or have filters applied
    const showTable = !isLoading && (prebuilds.length > 0 || hasFilters);

    return (
        <>
            <div className="app-container mb-8">
                <PageHeading title="Prebuilds" subtitle="View logs of all of the Prebuilds that have run." />

                {isLoading && <LoadingState />}

                {showTable && (
                    <PrebuildsTable
                        searchTerm={searchTerm}
                        prebuilds={prebuilds}
                        // we check isPreviousData too so we don't show spinner if it's a background refresh
                        isSearching={isFetching && isPreviousData}
                        isFetchingNextPage={isFetchingNextPage}
                        hasNextPage={!!hasNextPage}
                        hasMoreThanOnePage={hasMoreThanOnePage}
                        onLoadNextPage={() => fetchNextPage()}
                        onSearchTermChange={setSearchTerm}
                    />
                )}

                {!showTable && !isLoading && <PrebuildListEmptyState />}
            </div>
        </>
    );
};

export default PrebuildsListPage;
