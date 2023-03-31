/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { UserContext } from "../user-context";
import { getGitpodService } from "../service/service";
import { trackLocation } from "../Analytics";
import { refreshSearchData } from "../components/RepositoryFinder";
import { useQuery } from "@tanstack/react-query";
import { noPersistence } from "../data/setup";

export const useUserLoader = () => {
    const { user, setUser } = useContext(UserContext);

    // For now, we're using the user context to store the user, but letting react-query handle the loading
    // In the future, we should remove the user context and use react-query to access the user
    const { isLoading } = useQuery({
        queryKey: noPersistence(["current-user"]),
        queryFn: async () => {
            const user = await getGitpodService().server.getLoggedInUser();

            return user || null;
        },
        // We'll let an ErrorBoundary catch the error
        useErrorBoundary: true,
        cacheTime: 1000 * 60 * 60 * 1, // 1 hour
        staleTime: 1000 * 60 * 60 * 1, // 1 hour
        onSuccess: (loadedUser) => {
            setUser(loadedUser);
            refreshSearchData();
        },
        onSettled: (loadedUser) => {
            trackLocation(!!loadedUser);
        },
    });

    return { user, loading: isLoading };
};
