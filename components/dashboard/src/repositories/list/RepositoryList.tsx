/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, LoaderIcon } from "lucide-react";
import { useHistory } from "react-router-dom";
import { RepositoryListItem } from "./RepoListItem";
import { useListConfigurations } from "../../data/configurations/configuration-queries";
import { useStateWithDebounce } from "../../hooks/use-state-with-debounce";
import { TextInput } from "../../components/forms/TextInputField";
import { TextMuted } from "@podkit/typography/TextMuted";
import { PageHeading } from "@podkit/layout/PageHeading";
import { Button } from "@podkit/buttons/Button";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { PaginationControls, PaginationCountText } from "./PaginationControls";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@podkit/tables/Table";
import { ImportRepositoryModal } from "../create/ImportRepositoryModal";
import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";

const RepositoryListPage: FC = () => {
    useDocumentTitle("Imported repositories");

    const history = useHistory();

    // TODO: Move this state into url search params
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm, debouncedSearchTerm] = useStateWithDebounce("");

    const [sortBy, setSortBy] = useState<"name" | "creationTime">("name");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

    // Reset to page 1 when debounced search term changes (when we perform a new search)
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm]);

    // Have this set to a low value for now to test pagination while we develop this
    // TODO: move this into state and add control for changing it
    const pageSize = 2;

    const { data, isFetching, isPreviousData } = useListConfigurations({
        searchTerm: debouncedSearchTerm,
        page: currentPage,
        pageSize,
        sortBy,
        sortOrder,
    });
    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

    // TODO: Adding these to response payload to avoid having to calculate them here
    // This will fix issues w/ relying on some server provided state and some client state (like current page)
    const rowCount = data?.configurations.length ?? 0;
    const totalRows = data?.pagination?.total ?? 0;
    const totalPages = Math.ceil(totalRows / pageSize);

    const handleRepoImported = useCallback(
        (configuration: Configuration) => {
            history.push(`/repositories/${configuration.id}`);
        },
        [history],
    );

    const setSortCreationTime = useCallback(() => {
        setSortBy("creationTime");
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    }, [sortOrder]);

    const setSortName = useCallback(() => {
        setSortBy("name");
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    }, [sortOrder]);

    return (
        <>
            <div className="app-container">
                <PageHeading
                    title="Imported repositories"
                    subtitle="Configure and refine the experience of working with a repository in Gitpod"
                    action={<Button onClick={() => setShowCreateProjectModal(true)}>Import Repository</Button>}
                />

                {/* Search/Filter bar */}
                <div className="flex flex-row flex-wrap justify-between items-center">
                    <div className="flex flex-row flex-wrap gap-2 items-center">
                        {/* TODO: Add search icon on left and decide on pulling Inputs into podkit */}
                        <TextInput
                            className="w-80"
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Search imported repositories"
                        />
                        {/* TODO: Add prebuild status filter dropdown */}
                    </div>
                    {/* Account for variation of message when totalRows is greater than smallest page size option (20?) */}
                    <div>
                        <TextMuted className="text-sm">
                            {rowCount < totalRows ? (
                                <PaginationCountText
                                    currentPage={currentPage}
                                    pageSize={pageSize}
                                    currentRows={rowCount}
                                    totalRows={totalRows}
                                    includePrefix
                                />
                            ) : (
                                <>{totalRows === 1 ? "Showing 1 repo" : `Showing ${totalRows} repos`}</>
                            )}
                        </TextMuted>
                    </div>
                </div>

                <div className="relative w-full overflow-auto mt-2">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-52">
                                    <div className="flex flex-row items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                setSortBy("name");
                                                setSortOrder("asc");
                                            }}
                                        >
                                            Name
                                        </Button>
                                        {sortBy === "name" && sortOrder === "asc" && (
                                            <Button variant="ghost" onClick={setSortName}>
                                                <ChevronUpIcon />
                                            </Button>
                                        )}
                                        {sortBy === "name" && sortOrder === "desc" && (
                                            <Button variant="ghost" onClick={setSortName}>
                                                <ChevronDownIcon />
                                            </Button>
                                        )}
                                    </div>
                                </TableHead>
                                <TableHead hideOnSmallScreen>Repository</TableHead>
                                <TableHead className="w-32" hideOnSmallScreen>
                                    <div className="flex flex-row items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                setSortBy("creationTime");
                                                setSortOrder("asc");
                                            }}
                                        >
                                            Create
                                        </Button>
                                        {sortBy === "creationTime" && sortOrder === "asc" && (
                                            <Button variant="ghost" onClick={setSortCreationTime}>
                                                <ChevronUpIcon />
                                            </Button>
                                        )}
                                        {sortBy === "creationTime" && sortOrder === "desc" && (
                                            <Button variant="ghost" onClick={setSortCreationTime}>
                                                <ChevronDownIcon />
                                            </Button>
                                        )}
                                    </div>
                                </TableHead>
                                <TableHead className="w-24" hideOnSmallScreen>
                                    Prebuilds
                                </TableHead>
                                {/* Action column, loading status in header */}
                                <TableHead className="w-24 text-right">
                                    {isFetching && isPreviousData && (
                                        <div className="flex flex-right justify-end items-center">
                                            {/* TODO: Make a LoadingIcon component */}
                                            <LoaderIcon
                                                className="animate-spin text-gray-500 dark:text-gray-300"
                                                size={20}
                                            />
                                        </div>
                                    )}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data?.configurations.map((configuration) => (
                                <RepositoryListItem key={configuration.id} configuration={configuration} />
                            ))}
                        </TableBody>
                    </Table>

                    {totalPages > 1 && (
                        <PaginationControls
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalRows={totalRows}
                            pageSize={pageSize}
                            currentRows={rowCount}
                            onPageChanged={setCurrentPage}
                        />
                    )}
                </div>
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
