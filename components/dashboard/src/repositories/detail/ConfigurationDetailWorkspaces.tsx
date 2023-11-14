/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { useParams } from "react-router";
import { ConfigurationDetailPage } from "./ConfigurationDetailPage";
import { useConfiguration } from "../../data/configurations/configuration-queries";
import { ConfigurationWorkspaceSizeOptions } from "./workspaces/WorkpaceSizeOptions";

type PageRouteParams = {
    id: string;
};
const ConfigurationDetailWorkspaces: FC = () => {
    const { id } = useParams<PageRouteParams>();
    const configurationQuery = useConfiguration(id);
    const { data } = configurationQuery;

    return (
        <ConfigurationDetailPage configurationQuery={configurationQuery} id={id}>
            {data && (
                <>
                    <ConfigurationWorkspaceSizeOptions configuration={data} />
                </>
            )}
        </ConfigurationDetailPage>
    );
};

export default ConfigurationDetailWorkspaces;
