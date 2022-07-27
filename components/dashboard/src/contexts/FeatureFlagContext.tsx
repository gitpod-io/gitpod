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
    showUsageBasedPricingUI: boolean;
    showWorkspaceClassesUI: boolean;
    showPersistentVolumeClaimUI: boolean;
}>({
    showUsageBasedPricingUI: false,
    showWorkspaceClassesUI: false,
    showPersistentVolumeClaimUI: false,
});

const FeatureFlagContextProvider: React.FC = ({ children }) => {
    const { user } = useContext(UserContext);
    const { teams } = useContext(TeamsContext);
    const { project } = useContext(ProjectContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const [showUsageBasedPricingUI, setShowUsageBasedPricingUI] = useState<boolean>(false);
    const [showWorkspaceClassesUI, setShowWorkspaceClassesUI] = useState<boolean>(false);
    const [showPersistentVolumeClaimUI, setShowPersistentVolumeClaimUI] = useState<boolean>(false);

    const featureFlags: FeatureFlagConfig = {
        isUsageBasedBillingEnabled: { defaultValue: false, setter: setShowUsageBasedPricingUI },
        workspace_classes: { defaultValue: true, setter: setShowWorkspaceClassesUI },
        persistent_volume_claim: { defaultValue: true, setter: setShowPersistentVolumeClaimUI },
    };

    useEffect(() => {
        if (!user) return;
        (async () => {
            for (const [flagName, config] of Object.entries(featureFlags)) {
                const flagValue = await getExperimentsClient().getValueAsync(flagName, config.defaultValue, {
                    user,
                    projectId: project?.id,
                    teamId: team?.id,
                    teamName: team?.name,
                    teams,
                });
                config.setter(flagValue);
            }
        })();
    }, [user, teams, team, project]);

    return (
        <FeatureFlagContext.Provider
            value={{ showUsageBasedPricingUI, showWorkspaceClassesUI, showPersistentVolumeClaimUI }}
        >
            {children}
        </FeatureFlagContext.Provider>
    );
};

export { FeatureFlagContext, FeatureFlagContextProvider };
