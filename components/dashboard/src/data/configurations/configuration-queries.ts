/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { configurationClient } from "../../service/public-api";

const BASE_KEY = "configurations";

type ListConfigurationsQueryArgs = {
    searchTerm?: string;
    page: number;
    pageSize: number;
};

export const useListConfigurationsQuery = ({ searchTerm = "", page, pageSize }: ListConfigurationsQueryArgs) => {
    const { data: org } = useCurrentOrg();

    return useQuery(
        getListConfigurationsQueryKey(org?.id || "", { searchTerm, page, pageSize }),
        async () => {
            if (!org) {
                throw new Error("No org currently selected");
            }

            const response = await configurationClient.listConfigurations({
                organizationId: org.id,
                searchTerm,
                pagination: { page, pageSize },
            });

            return response;
        },
        {
            enabled: !!org,
        },
    );
};

export const getListConfigurationsQueryKey = (orgId: string, args?: ListConfigurationsQueryArgs) => {
    const key: any[] = [BASE_KEY, "list", { orgId }];
    if (args) {
        key.push(args);
    }

    return key;
};
