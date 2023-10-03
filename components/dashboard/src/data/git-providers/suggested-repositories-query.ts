/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { getGitpodService } from "../../service/service";

export const useSuggestedRepositories = () => {
    const { data: org } = useCurrentOrg();

    return useQuery(
        ["suggested-repositories", { orgId: org?.id }],
        async () => {
            if (!org) {
                throw new Error("No org selected");
            }

            return await getGitpodService().server.getSuggestedRepositories(org.id);
        },
        {
            // Keeps data in cache for 7 days - will still refresh though
            cacheTime: 1000 * 60 * 60 * 24 * 7,
        },
    );
};
