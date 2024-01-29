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
import { PrebuildListEmptyState } from "./PrebuildListEmptyState";
import { PrebuildListErrorState } from "./PrebuildListErrorState";
import { useStateWithDebounce } from "../../hooks/use-state-with-debounce";
import { PrebuildsTable } from "./PrebuildTable";
import { LoadingState } from "@podkit/loading/LoadingState";
import { useListOrganizationPrebuildsQuery } from "../../data/prebuilds/organization-prebuilds-query";
import { ListOrganizationPrebuildsRequest_Filter_State } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { validate } from "uuid";

const STATUS_FILTER_VALUES = ["succeeded", "failed", "unfinished", undefined] as const; // undefined means any status
export type STATUS_OPTION = typeof STATUS_FILTER_VALUES[number];
export type Filter = {
    status?: STATUS_OPTION;
    configurationId?: string;
};

const PrebuildsListPage: FC = () => {
    useDocumentTitle("Prebuilds");

    const history = useHistory();

    const params = useQueryParams();
    const [searchTerm, setSearchTerm, searchTermDebounced] = useStateWithDebounce(params.get("search") ?? "");
    const [statusFilter, setPrebuildsFilter] = useState(parseStatus(params));
    const configurationFilter = useMemo(() => parseConfigurationId(params), [params]);

    const handleFilterChange = useCallback((filter: Filter) => {
        setPrebuildsFilter(filter.status);
    }, []);
    const filter = useMemo<Filter>(() => {
        return {
            status: statusFilter,
            configurationId: configurationFilter,
        };
    }, [configurationFilter, statusFilter]);

    useEffect(() => {
        const params = new URLSearchParams();
        if (searchTermDebounced) {
            params.set("search", searchTermDebounced);
        }

        if (statusFilter) {
            params.set("prebuilds", statusFilter);
        }

        if (configurationFilter) {
            params.set("configurationId", configurationFilter);
        }

        params.toString();
        history.replace({ search: `?${params.toString()}` });
    }, [history, statusFilter, searchTermDebounced, configurationFilter]);

    // TODO: handle isError case
    const {
        data,
        isLoading,
        isFetching,
        isFetchingNextPage,
        isPreviousData,
        hasNextPage,
        fetchNextPage,
        isError,
        error,
    } = useListOrganizationPrebuildsQuery({
        filter: {
            searchTerm: searchTermDebounced,
            state: toApiStatus(filter.status),
            ...(configurationFilter ? { configuration: { id: configurationFilter } } : {}),
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
                {isError && <PrebuildListErrorState error={error} />}
            </div>
        </>
    );
};

const toApiStatus = (status: STATUS_OPTION): ListOrganizationPrebuildsRequest_Filter_State | undefined => {
    switch (status) {
        case "failed":
            return ListOrganizationPrebuildsRequest_Filter_State.FAILED; // todo: adjust to needs of proper status
        case "succeeded":
            return ListOrganizationPrebuildsRequest_Filter_State.SUCCEEDED;
        case "unfinished":
            return ListOrganizationPrebuildsRequest_Filter_State.UNFINISHED;
    }

    return undefined;
};

const parseStatus = (params: URLSearchParams): STATUS_OPTION => {
    const filter = params.get("prebuilds");
    const validValues = Object.values(STATUS_FILTER_VALUES).filter((val) => !!val);
    if (filter && validValues.includes(filter as any)) {
        return filter as STATUS_OPTION;
    }

    return undefined;
};

const parseConfigurationId = (params: URLSearchParams): string | undefined => {
    const configuration = params.get("configurationId");
    if (configuration && validate(configuration)) {
        return configuration;
    }

    return undefined;
};

export default PrebuildsListPage;
