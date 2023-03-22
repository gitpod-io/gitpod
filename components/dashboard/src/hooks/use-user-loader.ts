/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useState, useContext, useEffect } from "react";
import { User } from "@gitpod/gitpod-protocol";
import { UserContext } from "../user-context";
import { getGitpodService } from "../service/service";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { trackLocation } from "../Analytics";
import { refreshSearchData } from "../components/RepositoryFinder";

export const useUserLoader = () => {
    const [loading, setLoading] = useState<boolean>(true);
    const { user, setUser } = useContext(UserContext);
    const [isSetupRequired, setSetupRequired] = useState(false);

    useEffect(() => {
        (async () => {
            let loggedInUser: User | undefined;
            try {
                loggedInUser = await getGitpodService().server.getLoggedInUser();
                setUser(loggedInUser);
                refreshSearchData();
            } catch (error) {
                console.error(error);
                if (error && "code" in error) {
                    if (error.code === ErrorCodes.SETUP_REQUIRED) {
                        setSetupRequired(true);
                    }
                }
            } finally {
                trackLocation(!!loggedInUser);
            }
            setLoading(false);
            (window as any)._gp.path = window.location.pathname; //store current path to have access to previous when path changes
        })();
        // Ensure this only ever runs once
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { user, loading, isSetupRequired };
};
