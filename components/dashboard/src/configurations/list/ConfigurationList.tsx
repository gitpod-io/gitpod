/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import Header from "../../components/Header";
import { useListProjectsQuery } from "../../data/projects/project-queries";
import { Loader2 } from "lucide-react";
import { useHistory } from "react-router-dom";
import { Project } from "@gitpod/gitpod-protocol";
import { CreateProjectModal } from "../../projects/create-project-modal/CreateProjectModal";
import { Button } from "../../components/Button";
import { RepositoryListItem } from "./ConfigListItem";

const RepositoryListPage: FC = () => {
    const history = useHistory();
    const { data, isLoading } = useListProjectsQuery({ page: 1, pageSize: 10 });
    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

    const handleConfigurationCreated = useCallback(
        (configuration: Project) => {
            history.push(`/configurations/${configuration.id}`);
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

                {isLoading && <Loader2 className="animate-spin" />}

                <ul className="space-y-2 mt-8">
                    {!isLoading &&
                        data?.projects.map((project) => <RepositoryListItem key={project.id} project={project} />)}
                </ul>
            </div>

            {showCreateProjectModal && (
                <CreateProjectModal
                    onClose={() => setShowCreateProjectModal(false)}
                    onCreated={handleConfigurationCreated}
                />
            )}
        </>
    );
};

export default RepositoryListPage;
