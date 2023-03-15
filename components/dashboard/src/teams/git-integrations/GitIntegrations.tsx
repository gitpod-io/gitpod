/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent } from "react";
import { SpinnerLoader } from "../../components/Loader";
import { Heading2, Subheading } from "../../components/typography/headings";
import { useOrgAuthProvidersQuery } from "../../data/auth-providers/org-auth-providers-query";
import { GitIntegrationsList } from "./GitIntegrationsList";

export const GitIntegrations: FunctionComponent = () => {
    const { data, isLoading } = useOrgAuthProvidersQuery();

    if (isLoading) {
        return <SpinnerLoader />;
    }

    return (
        <div>
            <Heading2>Git Auth configurations</Heading2>
            <Subheading>Configure Git Auth for your organization.</Subheading>
            <GitIntegrationsList providers={data || []} />
        </div>
    );
};
