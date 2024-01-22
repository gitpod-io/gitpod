/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext, useEffect } from "react";
import { UserContext } from "../user-context";
import { trackLocation } from "../Analytics";
import { useQuery } from "@tanstack/react-query";
import { noPersistence } from "../data/setup";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { useFeatureFlag, useReportDashboardLoggingTracing } from "../data/featureflag-query";
import { userClient } from "../service/public-api";

export let userLoaded = false;
export const useUserLoader = () => {
    const { user, setUser } = useContext(UserContext);
    const doRetryUserLoader = useFeatureFlag("doRetryUserLoader");
    const logTracing = useReportDashboardLoggingTracing();

    // For now, we're using the user context to store the user, but letting react-query handle the loading
    // In the future, we should remove the user context and use react-query to access the user
    const { isLoading } = useQuery({
        queryKey: noPersistence(["current-user"]),
        queryFn: async () => {
            const user = (await logTracing(async () => userClient.getAuthenticatedUser({}), "on user loading")).user;
            return user || null;
        },
        // We'll let an ErrorBoundary catch the error
        useErrorBoundary: true,
        // It's important we don't retry as we want to show the login screen as quickly as possible if a 401
        retry: (_failureCount: number, error: Error & { code?: number }) => {
            if (!doRetryUserLoader) {
                return false;
            }
            return error.code !== ErrorCodes.NOT_AUTHENTICATED && error.code !== ErrorCodes.USER_DELETED;
        },
        // docs: https://tanstack.com/query/v4/docs/react/guides/query-retries
        // backoff by doubling, max. 10s
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        cacheTime: 1000 * 60 * 60 * 1, // 1 hour
        staleTime: 1000 * 60 * 60 * 1, // 1 hour
        onSuccess: (loadedUser) => {
            if (loadedUser) {
                setUser(loadedUser);
            }
        },
        onSettled: (loadedUser) => {
            trackLocation(!!loadedUser);
        },
    });

    useEffect(() => {
        userLoaded = !isLoading;
    }, [isLoading]);

    return { user, loading: isLoading };
};
