/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrganizationMember, OrganizationRole } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { organizationClient } from "../../service/public-api";
import { useCurrentUser } from "../../user-context";
import { useCurrentOrg } from "./orgs-query";

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
            enabled: !!organizationId,
        },
    );
    return query;
}

export function useIsOwner(): boolean {
    const role = useMemberRole();
    return role === OrganizationRole.OWNER;
}

export function useMemberRole(): OrganizationRole {
    const user = useCurrentUser();
    const members = useListOrganizationMembers();
    return useMemo(
        () => members.data?.find((m) => m.userId === user?.id)?.role ?? OrganizationRole.UNSPECIFIED,
        [members.data, user?.id],
    );
}

const roleScore: Record<OrganizationRole, number> = {
    [OrganizationRole.UNSPECIFIED]: 0,
    [OrganizationRole.COLLABORATOR]: 1,
    [OrganizationRole.MEMBER]: 2,
    [OrganizationRole.OWNER]: 3,
};

// Would be better to align schema.yaml but we can do it simple for now
export function useHasRolePermission(role: OrganizationRole): boolean {
    const userRole = useMemberRole();
    return useMemo(() => {
        if (userRole === OrganizationRole.UNSPECIFIED) {
            return false;
        }
        return roleScore[userRole] >= roleScore[role];
    }, [role, userRole]);
}

function getQueryKey(organizationId: string | undefined) {
    return ["listOrganizationMembers", organizationId || "undefined"];
}
