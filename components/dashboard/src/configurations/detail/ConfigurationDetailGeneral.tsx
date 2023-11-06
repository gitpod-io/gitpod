/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import Header from "../../components/Header";
import { useParams } from "react-router";
import { useProject } from "../../data/projects/project-queries";
import { ConfigurationNameForm } from "./ConfigurationName";
import { ConfigurationDetailPage } from "./ConfigurationDetailPage";

type PageRouteParams = {
    id: string;
};
const ConfigurationDetailGeneral: FC = () => {
    const { id } = useParams<PageRouteParams>();
    const configurationQuery = useProject({ id });

    return (
        <ConfigurationDetailPage projectQuery={configurationQuery} id={id}>
            <Header title="Repository Detail" subtitle="" />
            <div className="app-container">
                <ConfigurationNameForm project={configurationQuery.data!} />
            </div>
        </ConfigurationDetailPage>
    );
};

export default ConfigurationDetailGeneral;
