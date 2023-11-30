/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrganizationMember, OrganizationRole } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { organizationClient } from "../../service/public-api";
import { useCurrentOrg } from "./orgs-query";
import { useAuthenticatedUser } from "../current-user/authenticated-user-query";

export function useOrganizationMembersInvalidator() {
    const organizationId = useCurrentOrg().data?.id;
    const queryClient = useQueryClient();
    return useCallback(() => {
        queryClient.invalidateQueries(getQueryKey(organizationId));
    }, [organizationId, queryClient]);
}

export function useListOrganizationMembers() {
    const organizationId = useCurrentOrg().data?.id;
    const query = useQuery<OrganizationMember[], Error>(
        getQueryKey(organizationId),
        async () => {
            const response = await organizationClient.listOrganizationMembers({
                organizationId,
                pagination: {
                    pageSize: 1000,
                },
            });
            return response.members;
        },
        {
            staleTime: 1000 * 60 * 5, // 5 minutes
            enabled: !!organizationId,
        },
    );
    return query;
}

export function useIsOwner(): boolean {
    const { user } = useAuthenticatedUser();
    const members = useListOrganizationMembers();
    const isOwner = useMemo(() => {
        return members?.data?.some((m) => m.userId === user?.id && m.role === OrganizationRole.OWNER);
    }, [members?.data, user?.id]);
    return !!isOwner;
}

function getQueryKey(organizationId: string | undefined) {
    return ["listOrganizationMembers", organizationId || "undefined"];
}
