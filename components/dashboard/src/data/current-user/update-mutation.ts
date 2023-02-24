/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { useMutation } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";

type UpdateCurrentUserArgs = Partial<User>;

export const useUpdateCurrentUserMutation = () => {
    return useMutation({
        mutationFn: async (partialUser: UpdateCurrentUserArgs) => {
            return await getGitpodService().server.updateLoggedInUser(partialUser);
        },
    });
};
