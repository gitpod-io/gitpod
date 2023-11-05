/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { organizationClient } from "../../service/public-api";
import { useCurrentOrg } from "./orgs-query";

export function useInviteInvalidator() {
    const organizationId = useCurrentOrg().data?.id;
    const queryClient = useQueryClient();
    return useCallback(() => {
        queryClient.invalidateQueries(getQueryKey(organizationId));
    }, [organizationId, queryClient]);
}

export function useInvitationId() {
    const organizationId = useCurrentOrg().data?.id;
    const query = useQuery<string, Error>(
        getQueryKey(organizationId),
        async () => {
            const response = await organizationClient.getOrganizationInvitation({
                organizationId,
            });
            return response.invitationId;
        },
        {
            enabled: !!organizationId,
        },
    );
    return query;
}

export function useResetInvitationId() {
    const invalidate = useInviteInvalidator();
    return useMutation<void, Error, string>({
        mutationFn: async (orgId) => {
            if (!orgId) {
                throw new Error("No current organization selected");
            }

            await organizationClient.resetOrganizationInvitation({
                organizationId: orgId,
            });
        },
        onSuccess(updatedOrg) {
            invalidate();
        },
    });
}

function getQueryKey(organizationId: string | undefined) {
    return ["invitationId", organizationId || "undefined"];
}
