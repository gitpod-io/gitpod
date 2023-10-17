/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "../organizations/orgs-query";
import { projectsService } from "../../service/public-api";

type ListProjectsQueryArgs = {
    page: number;
    pageSize: number;
};

export const useListProjectsQuery = ({ page, pageSize }: ListProjectsQueryArgs) => {
    const { data: org } = useCurrentOrg();

    return useQuery(
        getListProjectsQueryKey(org?.id || "", { page, pageSize }),
        async () => {
            if (!org) {
                throw new Error("No org currently selected");
            }

            return projectsService.listProjects({ teamId: org.id, pagination: { page, pageSize } });
        },
        {
            enabled: !!org,
        },
    );
};

export const getListProjectsQueryKey = (orgId: string, { page, pageSize }: ListProjectsQueryArgs) => {
    return ["projects", "list", { orgId, page, pageSize }];
};
