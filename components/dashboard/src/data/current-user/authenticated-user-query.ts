/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { userClient } from "../../service/public-api";
import { GetAuthenticatedUserRequest, User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";

export const useAuthenticatedUser = () => {
    const query = useQuery<User>({
        queryKey: getAuthenticatedUserQueryKey(),
        queryFn: async () => {
            const params = new GetAuthenticatedUserRequest();
            const response = await userClient.getAuthenticatedUser(params);
            return response.user!;
        },
    });
    return query;
};

export const getAuthenticatedUserQueryKey = () => ["authenticated-user", {}];
