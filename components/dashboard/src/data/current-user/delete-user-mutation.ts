/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "../../user-context";
import { userClient } from "../../service/public-api";
import { DeleteUserRequest } from "@gitpod/public-api/lib/gitpod/v1/user_pb";

export const useDeleteUserMutation = () => {
    const user = useCurrentUser();

    return useMutation({
        mutationFn: async () => {
            if (!user) {
                throw new Error("No user present");
            }

            await userClient.deleteUser(
                new DeleteUserRequest({
                    userId: user.id,
                }),
            );
        },
    });
};
