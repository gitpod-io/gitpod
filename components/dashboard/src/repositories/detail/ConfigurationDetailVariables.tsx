/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { useParams } from "react-router";
import { ConfigurationDetailPage } from "./ConfigurationDetailPage";
import { useConfiguration } from "../../data/configurations/configuration-queries";
import { ConfigurationVariableList } from "./variables/ConfigurationVariableList";

type PageRouteParams = {
    id: string;
};
export const ConfigurationDetailVariables: FC = () => {
    const { id } = useParams<PageRouteParams>();
    const configurationQuery = useConfiguration(id);
    const { data } = configurationQuery;

    return (
        <ConfigurationDetailPage configurationQuery={configurationQuery} id={id}>
            {data && <ConfigurationVariableList configuration={data} />}
        </ConfigurationDetailPage>
    );
};
