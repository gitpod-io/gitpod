/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { useListConfigurations } from "../../data/configurations/configuration-queries";
import { PageHeading } from "@podkit/layout/PageHeading";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { ImportRepositoryModal } from "../create/ImportRepositoryModal";
import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { useQueryParams } from "../../hooks/use-query-params";
import { RepoListEmptyState } from "./RepoListEmptyState";
import { useStateWithDebounce } from "../../hooks/use-state-with-debounce";
import { RepositoryTable } from "./RepositoryTable";
import { LoadingState } from "@podkit/loading/LoadingState";
import { TableSortOrder } from "@podkit/tables/SortableTable";

const RepositoryListPage: FC = () => {
    useDocumentTitle("Imported repositories");

    const history = useHistory();

    const params = useQueryParams();
    const [searchTerm, setSearchTerm, searchTermDebounced] = useStateWithDebounce(params.get("search") || "");
    // TODO: Add this to query params
    const [prebuildsFilter, setPrebuildsFilter] = useState("all");
    const [sortBy, setSortBy] = useState(parseSortBy(params));
    const [sortOrder, setSortOrder] = useState<TableSortOrder>(parseSortOrder(params));
    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

    // TODO: abstract this into a more generic hook for next sortable table
    // Search/Filter params tracked in url query params
    useEffect(() => {
        const params = new URLSearchParams();
        if (searchTermDebounced) {
            params.set("search", searchTermDebounced);
        }
        if (sortBy) {
            params.set("sortBy", sortBy);
        }
        if (sortOrder) {
            params.set("sortOrder", sortOrder);
        }
        params.toString();
        history.replace({ search: `?${params.toString()}` });
    }, [history, searchTermDebounced, sortBy, sortOrder]);

    // TODO: handle isError case
    const { data, isLoading, isFetching, isFetchingNextPage, isPreviousData, hasNextPage, fetchNextPage } =
        useListConfigurations({
            searchTerm: searchTermDebounced,
            sortBy: sortBy,
            sortOrder: sortOrder,
            // Map ui prebuildFilter state to the right api value
            prebuildsEnabled: { all: undefined, enabled: true, disabled: false }[prebuildsFilter],
        });

    const handleRepoImported = useCallback(
        (configuration: Configuration) => {
            history.push(`/repositories/${configuration.id}`);
        },
        [history],
    );

    const handleSort = useCallback(
        (columnName: string, newSortOrder: TableSortOrder) => {
            setSortBy(columnName);
            setSortOrder(newSortOrder);
        },
        [setSortOrder],
    );

    const configurations = useMemo(() => {
        return data?.pages.map((page) => page.configurations).flat() ?? [];
    }, [data?.pages]);

    const hasMoreThanOnePage = (data?.pages.length ?? 0) > 1;

    // This tracks any filters/search params applied
    const hasFilters = !!searchTermDebounced || prebuildsFilter !== "all";

    // Show the table once we're done loading and either have results, or have filters applied
    const showTable = !isLoading && (configurations.length > 0 || hasFilters);

    return (
        <>
            <div className="app-container mb-8">
                <PageHeading
                    title="Imported repositories"
                    subtitle="Configure and refine the experience of working with a repository in Gitpod"
                />

                {isLoading && <LoadingState />}

                {showTable && (
                    <RepositoryTable
                        searchTerm={searchTerm}
                        prebuildsFilter={prebuildsFilter}
                        configurations={configurations}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        // we check isPreviousData too so we don't show spinner if it's a background refresh
                        isSearching={isFetching && isPreviousData}
                        isFetchingNextPage={isFetchingNextPage}
                        hasNextPage={!!hasNextPage}
                        hasMoreThanOnePage={hasMoreThanOnePage}
                        onImport={() => setShowCreateProjectModal(true)}
                        onLoadNextPage={() => fetchNextPage()}
                        onSearchTermChange={setSearchTerm}
                        onPrebuildsFilterChange={setPrebuildsFilter}
                        onSort={handleSort}
                    />
                )}

                {!showTable && !isLoading && <RepoListEmptyState onImport={() => setShowCreateProjectModal(true)} />}
            </div>

            {showCreateProjectModal && (
                <ImportRepositoryModal
                    onClose={() => setShowCreateProjectModal(false)}
                    onCreated={handleRepoImported}
                />
            )}
        </>
    );
};

export default RepositoryListPage;

const parseSortOrder = (params: URLSearchParams) => {
    const sortOrder = params.get("sortOrder");
    if (sortOrder === "asc" || sortOrder === "desc") {
        return sortOrder;
    }
    return "asc";
};

const parseSortBy = (params: URLSearchParams) => {
    const sortBy = params.get("sortBy");
    if (sortBy === "name" || sortBy === "creationTime") {
        return sortBy;
    }
    return "name";
};
