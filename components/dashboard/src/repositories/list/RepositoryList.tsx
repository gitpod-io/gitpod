/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect, useState } from "react";
import { LoaderIcon } from "lucide-react";
import { useHistory } from "react-router-dom";
import { Project } from "@gitpod/gitpod-protocol";
import { CreateProjectModal } from "../../projects/create-project-modal/CreateProjectModal";
import { RepositoryListItem } from "./RepoListItem";
import { useListConfigurations } from "../../data/configurations/configuration-queries";
import { useStateWithDebounce } from "../../hooks/use-state-with-debounce";
import { TextInput } from "../../components/forms/TextInputField";
import { TextMuted } from "@podkit/typography/TextMuted";
import { PageHeading } from "@podkit/layout/PageHeading";
import { Button } from "@podkit/buttons/Button";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { PaginationControls, PaginationCountText } from "./PaginationControls";

const RepositoryListPage: FC = () => {
    useDocumentTitle("Repository configuration");

    const history = useHistory();

    // TODO: Move this state into url search params
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm, debouncedSearchTerm] = useStateWithDebounce("");

    // Reset to page 1 when debounced search term changes (when we perform a new search)
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm]);

    // TODO: move this into state and add control for changing it
    const pageSize = 5;

    const { data, isFetching, isPreviousData } = useListConfigurations({
        searchTerm: debouncedSearchTerm,
        page: currentPage,
        pageSize,
    });
    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

    // TODO: Adding these to response payload to avoid having to calculate them here
    // This will fix issues w/ relying on some server provided state and some client state (like current page)
    const rowCount = data?.configurations.length ?? 0;
    const totalRows = data?.pagination?.total ?? 0;
    const totalPages = totalRows / pageSize;

    const handleProjectCreated = useCallback(
        (project: Project) => {
            history.push(`/repositories/${project.id}`);
        },
        [history],
    );

    return (
        <>
            <div className="app-container">
                <PageHeading
                    title="Repository configuration"
                    subtitle="Configure and refine the experience of working with a repository in Gitpod"
                    action={<Button onClick={() => setShowCreateProjectModal(true)}>Import Repository</Button>}
                />

                {/* Search/Filter bar */}
                <div className="flex flex-row justify-between items-center">
                    <div className="flex flex-row gap-2 items-center">
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
                    <table className="w-full text-left text-sm">
                        {/* TODO: Add sorting controls */}
                        <thead className="[&_th]:p-3 [&_th]:bg-gray-100 [&_th:first-child]:rounded-tl-md [&_th:last-child]:rounded-tr-md text-semibold">
                            <tr className="border-b">
                                <th className="w-48">Name</th>
                                <th className="hidden md:table-cell">Repository URL</th>
                                <th className="hidden md:table-cell w-32">Created</th>
                                <th className="hidden md:table-cell w-24">Prebuilds</th>
                                {/* Action column, loading status in header */}
                                <th className="w-24 text-right">
                                    {isFetching && isPreviousData && (
                                        <div className="flex flex-right justify-end items-center">
                                            <LoaderIcon className="animate-spin text-gray-500" size={20} />
                                        </div>
                                    )}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="[&_td]:p-3 [&_td:last-child]:text-right">
                            {data?.configurations.map((configuration) => (
                                <RepositoryListItem key={configuration.id} configuration={configuration} />
                            ))}
                        </tbody>
                    </table>

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
                <CreateProjectModal onClose={() => setShowCreateProjectModal(false)} onCreated={handleProjectCreated} />
            )}
        </>
    );
};

export default RepositoryListPage;
