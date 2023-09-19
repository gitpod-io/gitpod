/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useCurrentUser } from "../../user-context";
import { useCurrentOrg } from "../organizations/orgs-query";

export const useMaySetTimeout = () => {
    const user = useCurrentUser();
    const org = useCurrentOrg();

    return useQuery<boolean>({
        queryKey: getMaySetTimeoutQueryKey(user?.id ?? "", org.data?.id ?? ""),
        queryFn: async () => {
            if (!user) {
                throw new Error("No current user");
            }
            if (!org.data) {
                throw new Error("No current org");
            }

            return !!(await getGitpodService().server.maySetTimeout({ organizationId: org.data.id }));
        },
        enabled: !!user && !!org.data,
    });
};

export const getMaySetTimeoutQueryKey = (userId: string, orgId: string) => ["may-set-timeout", { userId }, { orgId }];
