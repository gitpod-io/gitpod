/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent } from "react";
import { SpinnerLoader } from "../../components/Loader";
import { useOrgAuthProvidersQuery } from "../../data/auth-providers/org-auth-providers-query";
import { GitIntegrationsList } from "./GitIntegrationsList";

export const GitIntegrations: FunctionComponent = () => {
    const { data, isLoading } = useOrgAuthProvidersQuery();

    if (isLoading) {
        return <SpinnerLoader />;
    }

    return <GitIntegrationsList providers={data || []} />;
};
