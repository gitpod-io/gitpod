/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useCurrentUser } from "../../user-context";

export const useUserMaySetTimeout = () => {
    const user = useCurrentUser();

    return useQuery<boolean>({
        queryKey: getUserMaySetTimeoutQueryKey(user?.id ?? ""),
        queryFn: async () => {
            if (!user) {
                throw new Error("No current user");
            }

            return !!(await getGitpodService().server.maySetTimeout());
        },
        enabled: !!user,
    });
};

export const getUserMaySetTimeoutQueryKey = (userId: string) => ["may-set-timeout", { userId }];
