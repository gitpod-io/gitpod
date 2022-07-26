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

const FeatureFlagContext = createContext<{ showUsageBasedPricingUI: boolean; showWorkspaceClassesUI: boolean }>({
    showUsageBasedPricingUI: false,
    showWorkspaceClassesUI: false,
});

const FeatureFlagContextProvider: React.FC = ({ children }) => {
    const { user } = useContext(UserContext);
    const { teams } = useContext(TeamsContext);
    const { project } = useContext(ProjectContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const [showUsageBasedPricingUI, setShowUsageBasedPricingUI] = useState<boolean>(false);
    const [showWorkspaceClassesUI, setShowWorkspaceClassesUI] = useState<boolean>(false);

    useEffect(() => {
        if (!user) {
            return;
        }
        (async () => {
            const isUsageBasedBillingEnabled = await getExperimentsClient().getValueAsync(
                "isUsageBasedBillingEnabled",
                false,
                {
                    user,
                    projectId: project?.id,
                    teamId: team?.id,
                    teamName: team?.name,
                    teams,
                },
            );
            setShowUsageBasedPricingUI(isUsageBasedBillingEnabled);

            const showWorkspaceClasses = await getExperimentsClient().getValueAsync("workspace_classes", true, {
                user,
            });
            setShowWorkspaceClassesUI(showWorkspaceClasses);
        })();
    }, [user, teams, team, project]);

    return (
        <FeatureFlagContext.Provider value={{ showUsageBasedPricingUI, showWorkspaceClassesUI }}>
            {children}
        </FeatureFlagContext.Provider>
    );
};

export { FeatureFlagContext, FeatureFlagContextProvider };
