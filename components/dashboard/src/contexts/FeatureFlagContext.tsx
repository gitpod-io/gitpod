/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
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
    showUsageView: boolean;
    isUsageBasedBillingEnabled: boolean;
    showUseLastSuccessfulPrebuild: boolean;
    usePublicApiWorkspacesService: boolean;
    enablePersonalAccessTokens: boolean;
}>({
    showUsageView: false,
    isUsageBasedBillingEnabled: false,
    showUseLastSuccessfulPrebuild: false,
    usePublicApiWorkspacesService: false,
    enablePersonalAccessTokens: false,
});

const FeatureFlagContextProvider: React.FC = ({ children }) => {
    const { user } = useContext(UserContext);
    const { teams } = useContext(TeamsContext);
    const { project } = useContext(ProjectContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const [showUsageView, setShowUsageView] = useState<boolean>(false);
    const [isUsageBasedBillingEnabled, setIsUsageBasedBillingEnabled] = useState<boolean>(false);
    const [showUseLastSuccessfulPrebuild, setShowUseLastSuccessfulPrebuild] = useState<boolean>(false);
    const [enablePersonalAccessTokens, setPersonalAccessTokensEnabled] = useState<boolean>(false);
    const [usePublicApiWorkspacesService, setUsePublicApiWorkspacesService] = useState<boolean>(false);

    useEffect(() => {
        if (!user) return;
        (async () => {
            const featureFlags: FeatureFlagConfig = {
                usage_view: { defaultValue: false, setter: setShowUsageView },
                isUsageBasedBillingEnabled: { defaultValue: false, setter: setIsUsageBasedBillingEnabled },
                showUseLastSuccessfulPrebuild: { defaultValue: false, setter: setShowUseLastSuccessfulPrebuild },
                personalAccessTokensEnabled: { defaultValue: false, setter: setPersonalAccessTokensEnabled },
                publicApiExperimentalWorkspaceService: {
                    defaultValue: false,
                    setter: setUsePublicApiWorkspacesService,
                },
            };

            for (const [flagName, config] of Object.entries(featureFlags)) {
                const value = async () => {
                    // First check if the flag is non-default for any of the teams
                    for (const team of teams || []) {
                        const flagValue = await getExperimentsClient().getValueAsync(flagName, config.defaultValue, {
                            user,
                            projectId: project?.id,
                            teamId: team.id,
                            teamName: team?.name,
                        });

                        if (flagValue !== config.defaultValue) {
                            // We got a non-default value, this must be configured by ConfigCat
                            return flagValue;
                        }
                    }

                    // Second evaluate if the flag is enabled for the user
                    const valueForUser = await getExperimentsClient().getValueAsync(flagName, config.defaultValue, {
                        user,
                        projectId: project?.id,
                        teamId: team?.id,
                        teamName: team?.name,
                    });

                    return valueForUser;
                };

                const val = await value();
                config.setter(val);
            }
        })();
    }, [user, teams, team, project]);

    return (
        <FeatureFlagContext.Provider
            value={{
                showUsageView,
                isUsageBasedBillingEnabled,
                showUseLastSuccessfulPrebuild,
                enablePersonalAccessTokens,
                usePublicApiWorkspacesService,
            }}
        >
            {children}
        </FeatureFlagContext.Provider>
    );
};

export { FeatureFlagContext, FeatureFlagContextProvider };

export const useFeatureFlags = () => {
    return useContext(FeatureFlagContext);
};
