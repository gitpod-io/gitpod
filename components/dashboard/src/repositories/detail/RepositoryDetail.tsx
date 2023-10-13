/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import Header from "../../components/Header";
import { useParams } from "react-router";

type PageRouteParams = {
    id: string;
};
const RepositoryDetailPage: FC = () => {
    const { id } = useParams<PageRouteParams>();

    return (
        <>
            <Header title="Repository Detail" subtitle="" />
            <div className="app-container">
                <span>id: {id}</span>
            </div>
        </>
    );
};

export default RepositoryDetailPage;
