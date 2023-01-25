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

    return (
        <div>
            <div className="flex items-start sm:justify-between mb-2">
                <div>
                    <h3>Git Integrations</h3>
                    <h2>Manage Git integrations for self-managed instances of GitLab, GitHub, or Bitbucket.</h2>
                </div>
            </div>

            {isLoading ? <SpinnerLoader /> : <GitIntegrationsList providers={data || []} />}
        </div>
    );
};
