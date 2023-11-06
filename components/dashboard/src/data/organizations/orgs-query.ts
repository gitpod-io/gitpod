/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useLocation } from "react-router";
import { organizationClient } from "../../service/public-api";
import { useCurrentUser } from "../../user-context";
import { noPersistence } from "../setup";
import { Organization } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";

export function useOrganizationsInvalidator() {
    const user = useCurrentUser();
    const queryClient = useQueryClient();
    return useCallback(() => {
        console.log("Invalidating orgs... " + JSON.stringify(getQueryKey(user)));
        queryClient.invalidateQueries(getQueryKey(user));
    }, [user, queryClient]);
}

export function useOrganizations() {
    const user = useCurrentUser();
    const query = useQuery<Organization[], Error>(
        getQueryKey(user),
        async () => {
            console.log("Fetching orgs... " + JSON.stringify(getQueryKey(user)));
            if (!user) {
                console.log("useOrganizations with empty user");
                return [];
            }

            const response = await organizationClient.listOrganizations({});
            return response.organizations;
        },
        {
            enabled: !!user,
            cacheTime: 1000 * 60 * 60 * 1, // 1 hour
            staleTime: 1000 * 60 * 60 * 1, // 1 hour
            // We'll let an ErrorBoundary catch the error
            useErrorBoundary: true,
        },
    );
    return query;
}

function getQueryKey(user?: User) {
    return noPersistence(["organizations", user?.id]);
}

// Custom hook to return the current org if one is selected
export function useCurrentOrg(): { data?: Organization; isLoading: boolean } {
    const location = useLocation();
    const orgs = useOrganizations();
    const user = useCurrentUser();

    if (orgs.isLoading || !orgs.data || !user) {
        return { data: undefined, isLoading: true };
    }
    let orgId = localStorage.getItem("active-org");
    const orgIdParam = new URLSearchParams(location.search).get("org");
    if (orgIdParam) {
        orgId = orgIdParam;
    }
    let org = orgs.data.find((org) => org.id === orgId);
    if (!org) {
        org = orgs.data[0];
    }
    if (org) {
        localStorage.setItem("active-org", org.id);
    } else if (orgId && (orgs.isLoading || orgs.isStale)) {
        // orgs are still fetching, but we have an orgId
        localStorage.setItem("active-org", orgId);
    } else {
        localStorage.removeItem("active-org");
    }
    return { data: org, isLoading: false };
}
