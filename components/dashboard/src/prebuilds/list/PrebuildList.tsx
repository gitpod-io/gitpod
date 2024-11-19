/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import { useQueryParams } from "../../hooks/use-query-params";
import { PrebuildListEmptyState } from "./PrebuildListEmptyState";
import { PrebuildListErrorState } from "./PrebuildListErrorState";
import { PrebuildsTable } from "./PrebuildTable";
import { LoadingState } from "@podkit/loading/LoadingState";
import { useListOrganizationPrebuildsQuery } from "../../data/prebuilds/organization-prebuilds-query";
import { ListOrganizationPrebuildsRequest_Filter_State, Prebuild } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { validate } from "uuid";
import type { TableSortOrder } from "@podkit/tables/SortableTable";
import { SortOrder } from "@gitpod/public-api/lib/gitpod/v1/sorting_pb";
import { RunPrebuildModal } from "./RunPrebuildModal";
import { isPrebuildDone, watchPrebuild } from "../../data/prebuilds/prebuild-queries";
import { Disposable } from "@gitpod/gitpod-protocol";

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

const pageSize = 30;

type Props = {
    initialFilter?: Filter;
    organizationId?: string;
    /**
     * If true, the configuration dropdown and the "Run Prebuild" button will be hidden.
     */
    hideOrgSpecificControls?: boolean;
};
export const PrebuildsList = ({ initialFilter, organizationId, hideOrgSpecificControls }: Props) => {
    const history = useHistory();
    const params = useQueryParams();

    const [statusFilter, setPrebuildsFilter] = useState(parseStatus(params) ?? initialFilter?.status);
    const [configurationFilter, setConfigurationFilter] = useState(
        parseConfigurationId(params) ?? initialFilter?.configurationId,
    );

    const [sortBy, setSortBy] = useState(parseSortBy(params));
    const [sortOrder, setSortOrder] = useState<TableSortOrder>(parseSortOrder(params));

    const [prebuilds, setPrebuilds] = useState<Prebuild[]>([]);

    const [showRunPrebuildModal, setShowRunPrebuildModal] = useState(false);

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
    const apiFilter = useMemo(() => {
        return {
            state: toApiStatus(statusFilter),
            ...(configurationFilter ? { configuration: { id: configurationFilter } } : {}),
        };
    }, [statusFilter, configurationFilter]);

    const sort = useMemo<Sort>(() => {
        return {
            sortBy,
            sortOrder,
        };
    }, [sortBy, sortOrder]);
    const apiSort = useMemo(() => {
        return {
            order: sortOrder === "desc" ? SortOrder.DESC : SortOrder.ASC,
            field: sortBy,
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

        if (configurationFilter && configurationFilter !== initialFilter?.configurationId) {
            params.set("configurationId", configurationFilter);
        }

        params.toString();
        history.replace({ search: `?${params.toString()}` });
    }, [history, statusFilter, configurationFilter, initialFilter?.configurationId]);

    const {
        data,
        isLoading,
        isFetching,
        isFetchingNextPage,
        isPreviousData,
        hasNextPage,
        refetch: refetchPrebuilds,
        fetchNextPage,
        isError,
        error,
    } = useListOrganizationPrebuildsQuery({
        filter: apiFilter,
        organizationId,
        sort: apiSort,
        pageSize,
    });

    const prebuildsData = useMemo(() => {
        return data?.pages.map((page) => page.prebuilds).flat() ?? [];
    }, [data?.pages]);

    useEffect(() => {
        // Watch prebuilds that are not done yet, and update their status
        const prebuilds = [...prebuildsData];
        const listeners = prebuilds.map((prebuild) => {
            if (isPrebuildDone(prebuild)) {
                return Disposable.NULL;
            }

            return watchPrebuild(prebuild.id, (update) => {
                const index = prebuilds.findIndex((p) => p.id === prebuild.id);
                if (index === -1) {
                    console.warn("Can't handle prebuild update");
                    return false;
                }

                prebuilds.splice(index, 1, update);
                setPrebuilds([...prebuilds]);

                return isPrebuildDone(update);
            });
        });
        setPrebuilds(prebuilds);

        return () => {
            listeners.forEach((l) => l?.dispose());
        };
    }, [prebuildsData, setPrebuilds]);

    const hasMoreThanOnePage = (data?.pages.length ?? 0) > 1;

    // This tracks any filters/search params applied
    const hasFilters = !!filter.status || !!filter.configurationId;

    // Show the table once we're done loading and either have results, or have filters applied
    const showTable = !isLoading && (prebuilds.length > 0 || hasFilters);

    return (
        <>
            {isLoading && <LoadingState />}

            {showTable && (
                <>
                    <PrebuildsTable
                        prebuilds={prebuilds}
                        // we check isPreviousData too so we don't show spinner if it's a background refresh
                        isSearching={isFetching && isPreviousData}
                        isFetchingNextPage={isFetchingNextPage}
                        hasNextPage={!!hasNextPage}
                        filter={filter}
                        sort={sort}
                        hasMoreThanOnePage={hasMoreThanOnePage}
                        hideOrgSpecificControls={!!hideOrgSpecificControls}
                        onLoadNextPage={() => fetchNextPage()}
                        onFilterChange={handleFilterChange}
                        onSort={handleSort}
                        onTriggerPrebuild={() => setShowRunPrebuildModal(true)}
                    />
                    <div className="flex justify-center mt-4">
                        <span className="text-pk-content-secondary text-xs max-w-md text-center">
                            Looking for older prebuilds? Prebuilds are garbage-collected if no workspace is started from
                            them within seven days. To view records of older prebuilds, please refer to the{" "}
                            <Link to={"/usage"} className="gp-link">
                                usage report
                            </Link>
                            .
                        </span>
                    </div>
                </>
            )}

            {showRunPrebuildModal && (
                <RunPrebuildModal
                    onClose={() => setShowRunPrebuildModal(false)}
                    onRun={() => {
                        refetchPrebuilds();
                    }}
                    defaultRepositoryId={configurationFilter}
                />
            )}

            {!showTable && !isLoading && (
                <PrebuildListEmptyState onTriggerPrebuild={() => setShowRunPrebuildModal(true)} />
            )}
            {isError && <PrebuildListErrorState error={error} />}
        </>
    );
};

const toApiStatus = (status: StatusOption): ListOrganizationPrebuildsRequest_Filter_State | undefined => {
    switch (status) {
        case "failed":
            return ListOrganizationPrebuildsRequest_Filter_State.FAILED;
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
