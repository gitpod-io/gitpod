/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import Header from "../../components/Header";
import { useParams } from "react-router";
import { useProject } from "../../data/projects/project-query";
import { Button } from "../../components/Button";
import { RepositoryNameForm } from "./RepositoryName";
import { Loader2 } from "lucide-react";
import Alert from "../../components/Alert";

type PageRouteParams = {
    id: string;
};
const RepositoryDetailPage: FC = () => {
    const { id } = useParams<PageRouteParams>();
    const { data, error, isLoading, refetch } = useProject({ id });

    return (
        <>
            <Header title="Repository Detail" subtitle="" />
            <div className="app-container">
                {isLoading && <Loader2 className="animate-spin" />}
                {error && (
                    <div className="gap-4">
                        <Alert type="error">
                            <span>Failed to load repository configuration</span>
                            <pre>{error.message}</pre>
                        </Alert>

                        <Button type="danger" onClick={refetch}>
                            Retry
                        </Button>
                    </div>
                )}
                {!isLoading &&
                    (!data ? (
                        // TODO: add a better not-found UI w/ link back to repositories
                        <div>Sorry, we couldn't find that repository configuration.</div>
                    ) : (
                        <RepositoryNameForm project={data} />
                    ))}
            </div>
        </>
    );
};

export default RepositoryDetailPage;
