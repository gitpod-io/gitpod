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

const RepositoryListPage: FC = () => {
    const history = useHistory();
    const [searchTerm, setSearchTerm, debouncedSearchTerm] = useStateWithDebounce("");
    const { data, isLoading } = useListConfigurations({ searchTerm: debouncedSearchTerm, page: 0, pageSize: 10 });
    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

    const handleProjectCreated = useCallback(
        (project: Project) => {
            history.push(`/configurations/${project.id}`);
        },
        [history],
    );

    return (
        <>
            <Header title="Configurations" subtitle="" />

            <div className="app-container">
                <div className="py-4 text-right">
                    <Button onClick={() => setShowCreateProjectModal(true)}>Configure Repository</Button>
                </div>

                <div>
                    <TextInput value={searchTerm} onChange={setSearchTerm} placeholder="Search repositories" />
                </div>

                {isLoading && <Loader2 className="animate-spin" />}

                <ul className="space-y-2 mt-8">
                    {!isLoading &&
                        data?.configurations.map((configuration) => (
                            <RepositoryListItem key={configuration.id} configuration={configuration} />
                        ))}
                </ul>
            </div>

            {showCreateProjectModal && (
                <CreateProjectModal onClose={() => setShowCreateProjectModal(false)} onCreated={handleProjectCreated} />
            )}
        </>
    );
};

export default RepositoryListPage;
