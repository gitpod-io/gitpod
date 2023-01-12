/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { useFetchUpdateWorkspaceDescription } from "./fetchers";

export const useUpdateWorkspaceDescription = () => {
    const updateDescription = useFetchUpdateWorkspaceDescription();

    return useMutation({
        mutationFn: updateDescription,
        mutationKey: ["workspaces", "update-description"],
    });
};
