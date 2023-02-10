/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useCurrentUser } from "../../user-context";

type UserBillingModeQueryResult = BillingMode;

export const useUserBillingMode = () => {
    const user = useCurrentUser();

    return useQuery<UserBillingModeQueryResult>({
        queryKey: getUserBillingModeQueryKey(user?.id ?? ""),
        queryFn: async () => {
            if (!user) {
                throw new Error("No current user, cannot load billing mode");
            }
            return await getGitpodService().server.getBillingModeForUser();
        },
        enabled: !!user,
    });
};

export const getUserBillingModeQueryKey = (userId: string) => ["billing-mode", { userId }];
