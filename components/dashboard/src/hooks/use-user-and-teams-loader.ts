/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useState, useContext, useEffect } from "react";
import { User } from "@gitpod/gitpod-protocol";
import { UserContext } from "../user-context";
import { TeamsContext } from "../teams/teams-context";
import { getGitpodService } from "../service/service";
import { publicApiTeamsToProtocol, teamsService } from "../service/public-api";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { trackLocation } from "../Analytics";
import { refreshSearchData } from "../components/RepositoryFinder";

export const useUserAndTeamsLoader = () => {
    const [loading, setLoading] = useState<boolean>(true);
    const { user, setUser, refreshUserBillingMode } = useContext(UserContext);
    const { teams, setTeams } = useContext(TeamsContext);
    const [isSetupRequired, setSetupRequired] = useState(false);

    useEffect(() => {
        (async () => {
            let loggedInUser: User | undefined;
            try {
                loggedInUser = await getGitpodService().server.getLoggedInUser();
                setUser(loggedInUser);
                refreshSearchData();

                const loadedTeams = publicApiTeamsToProtocol((await teamsService.listTeams({})).teams);
                setTeams(loadedTeams);
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

    // TODO: Can this check happen when we load the orgs rather than a separate effect?
    useEffect(() => {
        if (!teams) {
            return;
        }
        // Refresh billing mode (side effect on other components per UserContext!)
        refreshUserBillingMode();
    }, [teams, refreshUserBillingMode]);

    return { user, teams, loading, isSetupRequired };
};
