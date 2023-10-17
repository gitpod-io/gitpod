/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import Header from "../../components/Header";
import { useListProjectsQuery } from "../../data/projects/list-projects-query";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

const RepositoryListPage: FC = () => {
    const { data, isLoading } = useListProjectsQuery({ page: 1, pageSize: 10 });

    return (
        <>
            <Header title="Repositories" subtitle="" />

            {isLoading && <Loader2 className="animate-spin" />}
            {!isLoading &&
                data?.projects.map((project) => (
                    <div key={project.id}>
                        <span>{project.name}</span>
                        <Link to={`/repositories/${project.id}`}>View</Link>
                    </div>
                ))}
        </>
    );
};

export default RepositoryListPage;
