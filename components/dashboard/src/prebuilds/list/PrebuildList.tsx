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
import { PrebuildsTable } from "./PrebuildTable";
import { LoadingState } from "@podkit/loading/LoadingState";
import { useListOrganizationPrebuildsQuery } from "../../data/prebuilds/organization-prebuilds-query";
import { ListOrganizationPrebuildsRequest_Filter_State } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { validate } from "uuid";
import type { TableSortOrder } from "@podkit/tables/SortableTable";
import { SortOrder } from "@gitpod/public-api/lib/gitpod/v1/sorting_pb";

const STATUS_FILTER_VALUES = ["succeeded", "failed", "unfinished", undefined] as const; // undefined means any status
export type StatusOption = typeof STATUS_FILTER_VALUES[number];
export type Filter = {
    status?: StatusOption;
    configurationId?: string;
};

const SORT_FIELD_VALUES = ["creationTime"] as const;
export type SortField = typeof SORT_FIELD_VALUES[number];
export type Sort = {
    sortBy: SortField;
    sortOrder: TableSortOrder;
};

const PrebuildsListPage: FC = () => {
    useDocumentTitle("Prebuilds");

    const history = useHistory();
    const params = useQueryParams();

    const [statusFilter, setPrebuildsFilter] = useState(parseStatus(params));
    const [configurationFilter, setConfigurationFilter] = useState(parseConfigurationId(params));

    const [sortBy, setSortBy] = useState(parseSortBy(params));
    const [sortOrder, setSortOrder] = useState<TableSortOrder>(parseSortOrder(params));

    const handleFilterChange = useCallback((filter: Filter) => {
        setPrebuildsFilter(filter.status);
        setConfigurationFilter(filter.configurationId);
    }, []);
    const filter = useMemo<Filter>(() => {
        return {
            status: statusFilter,
            configurationId: configurationFilter,
        };
    }, [configurationFilter, statusFilter]);

    const sort = useMemo<Sort>(() => {
        return {
            sortBy,
            sortOrder,
        };
    }, [sortBy, sortOrder]);
    const handleSort = useCallback(
        (columnName: SortField, newSortOrder: TableSortOrder) => {
            setSortBy(columnName);
            setSortOrder(newSortOrder);
        },
        [setSortOrder],
    );

    useEffect(() => {
        const params = new URLSearchParams();

        if (statusFilter) {
            params.set("prebuilds", statusFilter);
        }

        if (configurationFilter) {
            params.set("configurationId", configurationFilter);
        }

        params.toString();
        history.replace({ search: `?${params.toString()}` });
    }, [history, statusFilter, configurationFilter]);

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
            state: toApiStatus(filter.status),
            ...(configurationFilter ? { configuration: { id: configurationFilter } } : {}),
        },
        sort: {
            order: sortOrder === "desc" ? SortOrder.DESC : SortOrder.ASC,
            field: sortBy,
        },
        pageSize: 30,
    });

    const prebuilds = useMemo(() => {
        return data?.pages.map((page) => page.prebuilds).flat() ?? [];
    }, [data?.pages]);

    const hasMoreThanOnePage = (data?.pages.length ?? 0) > 1;

    // This tracks any filters/search params applied
    const hasFilters = !!filter.status || !!filter.configurationId;

    // Show the table once we're done loading and either have results, or have filters applied
    const showTable = !isLoading && (prebuilds.length > 0 || hasFilters);

    return (
        <>
            <div className="app-container mb-8">
                <PageHeading title="Prebuilds" subtitle="Review prebuilds of your added repositories." />

                {isLoading && <LoadingState />}

                {showTable && (
                    <PrebuildsTable
                        prebuilds={prebuilds}
                        // we check isPreviousData too so we don't show spinner if it's a background refresh
                        isSearching={isFetching && isPreviousData}
                        isFetchingNextPage={isFetchingNextPage}
                        hasNextPage={!!hasNextPage}
                        filter={filter}
                        sort={sort}
                        hasMoreThanOnePage={hasMoreThanOnePage}
                        onLoadNextPage={() => fetchNextPage()}
                        onFilterChange={handleFilterChange}
                        onSort={handleSort}
                    />
                )}

                {!showTable && !isLoading && <PrebuildListEmptyState />}
                {isError && <PrebuildListErrorState error={error} />}
            </div>
        </>
    );
};

const toApiStatus = (status: StatusOption): ListOrganizationPrebuildsRequest_Filter_State | undefined => {
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

const isStatusOption = (value: any): value is StatusOption => {
    return STATUS_FILTER_VALUES.includes(value);
};
const parseStatus = (params: URLSearchParams): StatusOption => {
    const filter = params.get("prebuilds");
    if (filter && isStatusOption(filter)) {
        return filter;
    }

    return undefined;
};

const parseSortOrder = (params: URLSearchParams): TableSortOrder => {
    const sortOrder = params.get("sortOrder");
    if (sortOrder === "asc" || sortOrder === "desc") {
        return sortOrder;
    }
    return "desc";
};

const parseSortBy = (params: URLSearchParams): SortField => {
    const sortBy = params.get("sortBy");

    // todo: potentially allow more fields
    if (sortBy === "creationTime") {
        return sortBy;
    }
    return "creationTime";
};

const parseConfigurationId = (params: URLSearchParams): string | undefined => {
    const configuration = params.get("configurationId");
    if (configuration && validate(configuration)) {
        return configuration;
    }

    return undefined;
};

export default PrebuildsListPage;
