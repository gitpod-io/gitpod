/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "react-router";
import { getExperimentsClient } from "../experiments/client";
import { ProjectContext } from "../projects/project-context";
import { getCurrentTeam, TeamsContext } from "../teams/teams-context";
import { UserContext } from "../user-context";

interface FeatureFlagConfig {
    [flagName: string]: { defaultValue: boolean; setter: React.Dispatch<React.SetStateAction<boolean>> };
}

const FeatureFlagContext = createContext<{
    showPersistentVolumeClaimUI: boolean;
    showUsageView: boolean;
    showUseLastSuccessfulPrebuild: boolean;
    usePublicApiTeamsService: boolean;
}>({
    showPersistentVolumeClaimUI: false,
    showUsageView: false,
    showUseLastSuccessfulPrebuild: false,
    usePublicApiTeamsService: false,
});

const FeatureFlagContextProvider: React.FC = ({ children }) => {
    const { user } = useContext(UserContext);
    const { teams } = useContext(TeamsContext);
    const { project } = useContext(ProjectContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const [showPersistentVolumeClaimUI, setShowPersistentVolumeClaimUI] = useState<boolean>(false);
    const [showUsageView, setShowUsageView] = useState<boolean>(false);
    const [showUseLastSuccessfulPrebuild, setShowUseLastSuccessfulPrebuild] = useState<boolean>(false);
    const [usePublicApiTeamsService, setUsePublicApiTeamsService] = useState<boolean>(false);

    useEffect(() => {
        if (!user) return;
        (async () => {
            const featureFlags: FeatureFlagConfig = {
                persistent_volume_claim: { defaultValue: true, setter: setShowPersistentVolumeClaimUI },
                usage_view: { defaultValue: false, setter: setShowUsageView },
                showUseLastSuccessfulPrebuild: { defaultValue: false, setter: setShowUseLastSuccessfulPrebuild },
                publicApiExperimentalTeamsService: { defaultValue: false, setter: setUsePublicApiTeamsService },
            };
            for (const [flagName, config] of Object.entries(featureFlags)) {
                if (teams) {
                    for (const team of teams) {
                        const flagValue = await getExperimentsClient().getValueAsync(flagName, config.defaultValue, {
                            user,
                            projectId: project?.id,
                            teamId: team.id,
                            teamName: team?.name,
                        });

                        // We got an explicit override value from ConfigCat
                        if (flagValue !== config.defaultValue) {
                            config.setter(flagValue);
                            return;
                        }
                    }
                }

                const flagValue = await getExperimentsClient().getValueAsync(flagName, config.defaultValue, {
                    user,
                    projectId: project?.id,
                    teamId: team?.id,
                    teamName: team?.name,
                });
                config.setter(flagValue);
            }
        })();
    }, [user, teams, team, project]);

    return (
        <FeatureFlagContext.Provider
            value={{
                showPersistentVolumeClaimUI,
                showUsageView,
                showUseLastSuccessfulPrebuild,
                usePublicApiTeamsService,
            }}
        >
            {children}
        </FeatureFlagContext.Provider>
    );
};

export { FeatureFlagContext, FeatureFlagContextProvider };
