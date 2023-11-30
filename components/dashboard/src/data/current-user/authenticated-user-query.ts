/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { updateUserIdForExperiments, userClient } from "../../service/public-api";
import { GetAuthenticatedUserRequest } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { trackLocation } from "../../Analytics";
import { updateCommonErrorDetails } from "../../service/metrics";

export const useAuthenticatedUser = () => {
    const query = useQuery({
        queryKey: getAuthenticatedUserQueryKey(),
        queryFn: async () => {
            const params = new GetAuthenticatedUserRequest();
            const response = await userClient.getAuthenticatedUser(params);
            return response.user!;
        },
        // We'll let an ErrorBoundary catch the error
        useErrorBoundary: true,
        // It's important we don't retry as we want to show the login screen as quickly as possible if a 401
        retry: (_failureCount: number, error: Error & { code?: number }) => {
            return error.code !== ErrorCodes.NOT_AUTHENTICATED;
        },
        // docs: https://tanstack.com/query/v4/docs/react/guides/query-retries
        // backoff by doubling, max. 10s
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        cacheTime: 1000 * 60 * 60 * 1, // 1 hour
        staleTime: 1000 * 60 * 60 * 1, // 1 hour
        onSuccess: (loadedUser) => {
            startRefreshingJWT();
        },
        onSettled: (loadedUser) => {
            trackLocation(!!loadedUser);
            updateCommonErrorDetails({ userId: loadedUser?.id });
            updateUserIdForExperiments(loadedUser?.id);
        },
    });
    const { data, refetch, isLoading } = query;
    const reloadUser = refetch;

    return { user: data, reloadUser, loading: isLoading };
};

export const getAuthenticatedUserQueryKey = () => ["authenticated-user", {}];

function startRefreshingJWT() {
    // Schedule a periodic refresh of JWT cookie
    const w = window as any;
    const _gp = w._gp || (w._gp = {});

    const frequencyMs = 1000 * 60 * 60; // 1 hour
    if (!_gp.jwttimer) {
        // Store the timer on the window, to avoid queuing up multiple
        _gp.jwtTimer = setInterval(() => {
            fetch("/api/auth/jwt-cookie", {
                credentials: "include",
            })
                .then((resp) => resp.text())
                .then((text) => console.log(`Completed JWT Cookie refresh: ${text}`))
                .catch((err) => {
                    console.log("Failed to update jwt-cookie", err);
                });
        }, frequencyMs);
    }
}
