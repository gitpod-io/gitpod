/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, Loader2 } from "lucide-react";
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

const RepositoryListPage: FC = () => {
    useDocumentTitle("Repository configuration");

    const history = useHistory();

    // TODO: Consider pushing this state into query params
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm, debouncedSearchTerm] = useStateWithDebounce("");

    const pageSize = 10;

    const { data, isLoading } = useListConfigurations({ searchTerm: debouncedSearchTerm, page: currentPage, pageSize });
    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

    const totalRows = data?.pagination?.total ?? 0;
    // TODO: add this to response payload for pagination
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
                {/* TODO: Consider updating Header to have an action button prop */}
                <PageHeading
                    title="Repository configuration"
                    subtitle="Configure and refine the experience of working with a repository in Gitpod"
                    action={<Button onClick={() => setShowCreateProjectModal(true)}>Import Repository</Button>}
                />

                {/* Search/Filter bar */}
                <div className="flex flex-row justify-between items-center">
                    <div>
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
                            {totalRows === 1 ? "Showing 1 repo" : `Showing ${totalRows} repos`}
                        </TextMuted>
                    </div>
                </div>

                {isLoading && <Loader2 className="animate-spin" />}

                <div className="relative w-full overflow-auto mt-2">
                    <table className="w-full text-left text-sm">
                        <thead className="[&_th]:p-3 [&_th]:bg-gray-100 [&_th:first-child]:rounded-tl-md [&_th:last-child]:rounded-tr-md text-semibold">
                            <tr className="border-b">
                                <th className="bg-gray-100">Name</th>
                                <th className="hidden md:table-cell">Repository URL</th>
                                <th className="hidden md:table-cell">Created</th>
                                <th className="hidden md:table-cell">Prebuilds</th>
                                {/* Action column */}
                                <th></th>
                            </tr>
                        </thead>
                        <tbody className="[&_td]:p-3 [&_td:last-child]:text-right">
                            {data?.configurations.map((configuration) => (
                                <RepositoryListItem key={configuration.id} configuration={configuration} />
                            ))}
                        </tbody>
                    </table>

                    {totalPages > 1 && (
                        <div className="flex flex-row justify-center items-center py-2 gap-2">
                            {/* TODO: Rows per page select */}
                            {/* TODO: Current records copy, i.e. "1-50 of 95" */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setCurrentPage(currentPage - 1)}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeftIcon size={20} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setCurrentPage(currentPage + 1)}
                                disabled={currentPage >= totalPages}
                            >
                                <ChevronRightIcon size={20} />
                            </Button>
                        </div>
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
