/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../service/service";

export const useCurrentUser = () => {
    return useQuery({
        queryKey: ["users", "current"],
        queryFn: async () => {
            return await getGitpodService().server.getLoggedInUser();
        },
    });
};
