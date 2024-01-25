/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { PageHeading } from "@podkit/layout/PageHeading";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { useQueryParams } from "../../hooks/use-query-params";
import { PrebuildListEmptyState } from "./PrebuildEmptyListState";
import { useStateWithDebounce } from "../../hooks/use-state-with-debounce";
import { Filter, PrebuildsTable } from "./PrebuildsTable";
import { LoadingState } from "@podkit/loading/LoadingState";
import { useListOrganizationPrebuildsQuery } from "../../data/prebuilds/organization-prebuilds-query";
import { PrebuildPhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";

const STATUS_FILTER = ["succeeded", "failed", "unfinished", undefined] as const; // undefined means any status
export type STATUS_FILTER_VALUES = typeof STATUS_FILTER[number];

const PrebuildsListPage: FC = () => {
    useDocumentTitle("Prebuilds");

    const history = useHistory();

    const params = useQueryParams();
    const [searchTerm, setSearchTerm, searchTermDebounced] = useStateWithDebounce(params.get("search") ?? "");
    const [statusFilter, setPrebuildsFilter] = useState(parseStatus(params));

    const handleFilterChange = useCallback((filter: Filter) => {
        setPrebuildsFilter(filter.status);
    }, []);
    const filter = useMemo<Filter>(() => {
        return {
            status: statusFilter,
        };
    }, [statusFilter]);

    useEffect(() => {
        const params = new URLSearchParams();
        if (searchTermDebounced) {
            params.set("search", searchTermDebounced);
        }

        // Since "any" is the default, we don't need to set it in the url
        if (statusFilter) {
            params.set("prebuilds", statusFilter);
        }

        params.toString();
        history.replace({ search: `?${params.toString()}` });
    }, [history, statusFilter, searchTermDebounced]);

    // TODO: handle isError case
    const { data, isLoading, isFetching, isFetchingNextPage, isPreviousData, hasNextPage, fetchNextPage } =
        useListOrganizationPrebuildsQuery({
            filter: {
                searchTerm: searchTermDebounced,
                status: toApiStatus(filter.status),
            },
            pageSize: 30,
        });

    const prebuilds = useMemo(() => {
        return data?.pages.map((page) => page.prebuilds).flat() ?? [];
    }, [data?.pages]);

    const hasMoreThanOnePage = (data?.pages.length ?? 0) > 1;

    // This tracks any filters/search params applied
    const hasFilters = !!searchTermDebounced || !!filter.status;

    // Show the table once we're done loading and either have results, or have filters applied
    const showTable = !isLoading && (prebuilds.length > 0 || hasFilters);

    return (
        <>
            <div className="app-container mb-8">
                <PageHeading title="Prebuilds" subtitle="Review prebuilds of your imported repositories." />

                {isLoading && <LoadingState />}

                {showTable && (
                    <PrebuildsTable
                        searchTerm={searchTerm}
                        prebuilds={prebuilds}
                        // we check isPreviousData too so we don't show spinner if it's a background refresh
                        isSearching={isFetching && isPreviousData}
                        isFetchingNextPage={isFetchingNextPage}
                        hasNextPage={!!hasNextPage}
                        filter={filter}
                        hasMoreThanOnePage={hasMoreThanOnePage}
                        onLoadNextPage={() => fetchNextPage()}
                        onFilterChange={handleFilterChange}
                        onSearchTermChange={setSearchTerm}
                    />
                )}

                {!showTable && !isLoading && <PrebuildListEmptyState />}
            </div>
        </>
    );
};

const toApiStatus = (status: STATUS_FILTER_VALUES): PrebuildPhase_Phase | undefined => {
    switch (status) {
        case "failed":
            return PrebuildPhase_Phase.FAILED; // todo: adjust to needs of proper status
        case "succeeded":
            return PrebuildPhase_Phase.AVAILABLE;
        case "unfinished":
            return PrebuildPhase_Phase.BUILDING;
    }

    return undefined;
};

const parseStatus = (params: URLSearchParams): STATUS_FILTER_VALUES => {
    const filter = params.get("prebuilds");
    const validValues = Object.values(STATUS_FILTER).filter((val) => !!val);
    if (filter && validValues.includes(filter as any)) {
        return filter as STATUS_FILTER_VALUES;
    }

    return undefined;
};

export default PrebuildsListPage;
