/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { scmClient } from "../../service/public-api";

type Props = {
    excludeConfigurations: boolean;
};
export const useSuggestedRepositories = ({ excludeConfigurations }: Props) => {
    const { data: org } = useCurrentOrg();

    return useQuery(
        ["suggested-repositories", { orgId: org?.id, excludeConfigurations }],
        async () => {
            if (!org) {
                throw new Error("No org selected");
            }

            const { repositories } = await scmClient.listSuggestedRepositories({
                organizationId: org.id,
                excludeConfigurations,
            });
            return repositories;
        },
        {
            // Keeps data in cache for 7 days - will still refresh though
            cacheTime: 1000 * 60 * 60 * 24 * 7,
        },
    );
};
