/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import Header from "../../components/Header";
import { Loader2 } from "lucide-react";
import { useHistory } from "react-router-dom";
import { Project } from "@gitpod/gitpod-protocol";
import { CreateProjectModal } from "../../projects/create-project-modal/CreateProjectModal";
import { Button } from "../../components/Button";
import { RepositoryListItem } from "./RepoListItem";
import { useListConfigurations } from "../../data/configurations/configuration-queries";
import { useStateWithDebounce } from "../../hooks/use-state-with-debounce";
import { TextInput } from "../../components/forms/TextInputField";
import Pagination from "../../Pagination/Pagination";

const RepositoryListPage: FC = () => {
    const history = useHistory();

    // TODO: Consider pushing this state into query params
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm, debouncedSearchTerm] = useStateWithDebounce("");

    const pageSize = 10;

    const { data, isLoading } = useListConfigurations({ searchTerm: debouncedSearchTerm, page: currentPage, pageSize });
    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

    // TODO: add this to response payload for pagination
    const totalPages = data?.pagination?.total ?? 0 / pageSize;

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
                <div className="flex flex-row justify-between">
                    <Header
                        title="Repository Configuration"
                        subtitle="Configure and refine the experience of working with a repository in Gitpod"
                    />
                    <Button onClick={() => setShowCreateProjectModal(true)}>Import Repository</Button>
                </div>

                {/* Search/Filter bar */}
                <div className="flex flex-row justify-between">
                    <div>
                        <TextInput
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Search imported repositories"
                        />
                        {/* TODO: Add prebuild status filter dropdown */}
                    </div>
                    <div>{/* TODO: Add copy explaining what records we're showing & total records count */}</div>
                </div>

                {isLoading && <Loader2 className="animate-spin" />}

                <table className="w-full text-left">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Repository URL</th>
                            <th>Created</th>
                            <th>Prebuilds</th>
                            {/* Action column */}
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {data?.configurations.map((configuration) => (
                            <RepositoryListItem key={configuration.id} configuration={configuration} />
                        ))}
                    </tbody>
                </table>

                {/* TODO: Refactor Pagination into podkit or to use podkit components internally */}
                <Pagination currentPage={currentPage} setPage={setCurrentPage} totalNumberOfPages={totalPages} />
            </div>

            {showCreateProjectModal && (
                <CreateProjectModal onClose={() => setShowCreateProjectModal(false)} onCreated={handleProjectCreated} />
            )}
        </>
    );
};

export default RepositoryListPage;
