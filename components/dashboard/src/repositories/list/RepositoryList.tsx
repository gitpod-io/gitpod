/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { useListConfigurations } from "../../data/configurations/configuration-queries";
import { PageHeading } from "@podkit/layout/PageHeading";
import { Button } from "@podkit/buttons/Button";
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
    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

    // TODO: add type for these columns in query
    const [sortBy, setSortBy] = useState("name");
    const [sortOrder, setSortOrder] = useState<TableSortOrder>("asc");

    // Search/Filter params tracked in url query params
    useEffect(() => {
        const params = searchTermDebounced ? `?search=${encodeURIComponent(searchTermDebounced)}` : "";
        history.replace({ search: params });
    }, [history, searchTermDebounced]);

    // TODO: handle isError case
    const { data, isLoading, isFetching, isFetchingNextPage, isPreviousData, hasNextPage, fetchNextPage } =
        useListConfigurations({
            searchTerm: searchTermDebounced,
            sortBy: sortBy,
            sortOrder: sortOrder,
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
    const hasFilters = !!searchTermDebounced;

    // Show the table once we're done loading and either have results, or have filters applied
    const showTable = !isLoading && (configurations.length > 0 || hasFilters);

    return (
        <>
            <div className="app-container mb-8">
                <PageHeading
                    title="Imported repositories"
                    subtitle="Configure and refine the experience of working with a repository in Gitpod"
                    action={
                        showTable && <Button onClick={() => setShowCreateProjectModal(true)}>Import Repository</Button>
                    }
                />

                {isLoading && <LoadingState />}

                {showTable && (
                    <RepositoryTable
                        searchTerm={searchTerm}
                        configurations={configurations}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        // we check isPreviousData too so we don't show spinner if it's a background refresh
                        isSearching={isFetching && isPreviousData}
                        isFetchingNextPage={isFetchingNextPage}
                        hasNextPage={!!hasNextPage}
                        hasMoreThanOnePage={hasMoreThanOnePage}
                        onLoadNextPage={() => fetchNextPage()}
                        onSearchTermChange={setSearchTerm}
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
