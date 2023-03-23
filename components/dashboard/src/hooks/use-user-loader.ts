/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useState, useContext } from "react";
import { User } from "@gitpod/gitpod-protocol";
import { UserContext } from "../user-context";
import { getGitpodService } from "../service/service";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { trackLocation } from "../Analytics";
import { refreshSearchData } from "../components/RepositoryFinder";
import { useQuery } from "@tanstack/react-query";
import { noPersistence } from "../data/setup";

export const useUserLoader = () => {
    const { user, setUser } = useContext(UserContext);
    const [isSetupRequired, setSetupRequired] = useState(false);

    // For now, we're using the user context to store the user, but letting react-query handle the loading
    // In the future, we should remove the user context and use react-query to access the user
    const { isLoading } = useQuery({
        queryKey: noPersistence(["current-user"]),
        queryFn: async () => {
            let user: User | undefined;
            try {
                user = await getGitpodService().server.getLoggedInUser();
                setUser(user);
                refreshSearchData();
            } catch (error) {
                if (error && "code" in error) {
                    if (error.code === ErrorCodes.SETUP_REQUIRED) {
                        setSetupRequired(true);
                        return;
                    }

                    // If it was a server error, throw it so we can catch it with an ErrorBoundary
                    if (error.code >= 500) {
                        throw error;
                    }

                    // Other errors will treat user as needing to log in
                }
            } finally {
                trackLocation(!!user);
            }

            return user || null;
        },
        // We'll let an ErrorBoundary catch the error
        useErrorBoundary: true,
        cacheTime: 1000 * 60 * 60 * 1, // 1 hour
        staleTime: 1000 * 60 * 60 * 1, // 1 hour
    });

    return { user, loading: isLoading, isSetupRequired };
};
