/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import Header from "../../components/Header";
import { useHistory, useParams } from "react-router";
import { ConfigurationNameForm } from "./ConfigurationName";
import { ConfigurationDetailPage } from "./ConfigurationDetailPage";
import { useConfiguration } from "../../data/configurations/configuration-queries";
import { RemoveConfigurationModal } from "./RemoveConfigurationModal";

type PageRouteParams = {
    id: string;
};
const ConfigurationDetailGeneral: FC = () => {
    const { id } = useParams<PageRouteParams>();
    const configurationQuery = useConfiguration(id);
    const [showRemoveModal, setShowRemoveModal] = useState(false);

    const history = useHistory();
    const onProjectRemoved = useCallback(() => {
        history.push("/projects");
    }, [history]);

    return (
        <ConfigurationDetailPage configurationQuery={configurationQuery} id={id}>
            <Header title="Repository Detail" subtitle="" />
            <div className="app-container">
                <ConfigurationNameForm configuration={configurationQuery.data!} />
                {configurationQuery.data && showRemoveModal && (
                    <RemoveConfigurationModal
                        configuration={configurationQuery.data}
                        onRemoved={onProjectRemoved}
                        onClose={() => setShowRemoveModal(false)}
                    />
                )}
            </div>
        </ConfigurationDetailPage>
    );
};

export default ConfigurationDetailGeneral;
