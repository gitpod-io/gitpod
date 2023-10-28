/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import Header from "../../components/Header";
import { useParams } from "react-router";
import { useProject } from "../../data/projects/project-queries";
import { Button } from "../../components/Button";
import { ConfigurationNameForm } from "./ConfigurationName";
import { Loader2 } from "lucide-react";
import Alert from "../../components/Alert";
import ConfigurationPrebuildsSettings from "./ConfigurationPrebuilds";
import ConfigurationWorkspacesSettings from "./ConfigurationWorkspaces";
import DeleteConfiguration from "./ConfigurationDelete";
import ConfigurationEnvironmentVariables from "./variables/ConfigurationVariables";

type PageRouteParams = {
    id: string;
};
const ConfigurationDetailPage: FC = () => {
    const { id } = useParams<PageRouteParams>();
    const { data, isLoading, error, refetch } = useProject({ id });

    return (
        <>
            <Header title="Configuration Detail" />
            <div className="app-container mb-16">
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
                        <>
                            <ConfigurationNameForm configuration={data} />
                            <ConfigurationEnvironmentVariables configuration={data} />
                            <ConfigurationPrebuildsSettings repository={data} />
                            <ConfigurationWorkspacesSettings repository={data} />
                            <DeleteConfiguration configuration={data} />
                        </>
                    ))}
            </div>
        </>
    );
};

export default ConfigurationDetailPage;
