/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useCurrentTeam } from "../../teams/teams-context";
import { getOrgAuthProvidersQueryKey, OrgAuthProvidersQueryResult } from "./org-auth-providers-query";

type DeleteAuthProviderArgs = {
    providerId: string;
};
export const useDeleteOrgAuthProviderMutation = () => {
    const queryClient = useQueryClient();
    const organization = useCurrentTeam();

    return useMutation({
        mutationFn: async ({ providerId }: DeleteAuthProviderArgs) => {
            if (!organization) {
                throw new Error("No current organization selected");
            }

            return await getGitpodService().server.deleteOrgAuthProvider({
                id: providerId,
                organizationId: organization.id,
            });
        },
        onSuccess: (_, { providerId }) => {
            if (!organization) {
                throw new Error("No current organization selected");
            }

            const queryKey = getOrgAuthProvidersQueryKey(organization.id);
            queryClient.setQueryData<OrgAuthProvidersQueryResult>(queryKey, (providers) => {
                return providers?.filter((p) => p.id !== providerId);
            });

            queryClient.invalidateQueries({ queryKey });
        },
    });
};
