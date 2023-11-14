/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { useParams } from "react-router";
import { ConfigurationNameForm } from "./general/ConfigurationName";
import { ConfigurationDetailPage } from "./ConfigurationDetailPage";
import { useConfiguration } from "../../data/configurations/configuration-queries";
import { RemoveConfiguration } from "./general/RemoveConfiguration";

type PageRouteParams = {
    id: string;
};
const ConfigurationDetailGeneral: FC = () => {
    const { id } = useParams<PageRouteParams>();
    const configurationQuery = useConfiguration(id);
    const { data } = configurationQuery;

    return (
        <ConfigurationDetailPage configurationQuery={configurationQuery} id={id}>
            {data && (
                <>
                    <ConfigurationNameForm configuration={data} />
                    <RemoveConfiguration configuration={data} />
                </>
            )}
        </ConfigurationDetailPage>
    );
};

export default ConfigurationDetailGeneral;
