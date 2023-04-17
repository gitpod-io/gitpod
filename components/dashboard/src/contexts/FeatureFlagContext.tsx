/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useCurrentOrg, useOrganizations } from "../data/organizations/orgs-query";
import { getExperimentsClient } from "../experiments/client";
import { ProjectContext } from "../projects/project-context";
import { UserContext } from "../user-context";

interface FeatureFlagConfig {
    [flagName: string]: { defaultValue: boolean; setter: React.Dispatch<React.SetStateAction<boolean>> };
}

type FeatureFlagsType = {
    [k in keyof typeof defaultFeatureFlags]: boolean;
};

const defaultFeatureFlags = {
    startWithOptions: false,
    showUsageView: false,
    isUsageBasedBillingEnabled: false,
    showUseLastSuccessfulPrebuild: false,
    usePublicApiWorkspacesService: false,
    enablePersonalAccessTokens: false,
    oidcServiceEnabled: false,
    // Default to true to enable on gitpod dedicated until ff support is added for dedicated
    orgGitAuthProviders: true,
    userGitAuthProviders: false,
    newSignupFlow: false,
    linkedinConnectionForOnboarding: false,
    experimentalIdes: false,
};

const FeatureFlagContext = createContext<FeatureFlagsType>(defaultFeatureFlags);

const FeatureFlagContextProvider: React.FC = ({ children }) => {
    const { user } = useContext(UserContext);
    const orgs = useOrganizations().data;
    const { project } = useContext(ProjectContext);
    const currentOrg = useCurrentOrg();
    const [startWithOptions, setStartWithOptions] = useState<boolean>(false);
    const [showUsageView, setShowUsageView] = useState<boolean>(false);
    const [isUsageBasedBillingEnabled, setIsUsageBasedBillingEnabled] = useState<boolean>(false);
    const [showUseLastSuccessfulPrebuild, setShowUseLastSuccessfulPrebuild] = useState<boolean>(false);
    const [enablePersonalAccessTokens, setPersonalAccessTokensEnabled] = useState<boolean>(false);
    const [usePublicApiWorkspacesService, setUsePublicApiWorkspacesService] = useState<boolean>(false);
    const [oidcServiceEnabled, setOidcServiceEnabled] = useState<boolean>(false);
    const [orgGitAuthProviders, setOrgGitAuthProviders] = useState<boolean>(false);
    const [userGitAuthProviders, setUserGitAuthProviders] = useState<boolean>(false);
    const [newSignupFlow, setNewSignupFlow] = useState<boolean>(false);
    const [linkedinConnectionForOnboarding, setLinkedinConnectionForOnboarding] = useState<boolean>(false);
    const [experimentalIdes, setExperimentalIdes] = useState<boolean>(false);

    useEffect(() => {
        if (!user) return;
        (async () => {
            const featureFlags: FeatureFlagConfig = {
                start_with_options: { defaultValue: false, setter: setStartWithOptions },
                usage_view: { defaultValue: false, setter: setShowUsageView },
                isUsageBasedBillingEnabled: { defaultValue: false, setter: setIsUsageBasedBillingEnabled },
                showUseLastSuccessfulPrebuild: { defaultValue: false, setter: setShowUseLastSuccessfulPrebuild },
                personalAccessTokensEnabled: { defaultValue: false, setter: setPersonalAccessTokensEnabled },
                publicApiExperimentalWorkspaceService: {
                    defaultValue: false,
                    setter: setUsePublicApiWorkspacesService,
                },
                oidcServiceEnabled: { defaultValue: false, setter: setOidcServiceEnabled },
                // Default to true to enable on gitpod dedicated until ff support is added for dedicated
                orgGitAuthProviders: { defaultValue: true, setter: setOrgGitAuthProviders },
                userGitAuthProviders: { defaultValue: false, setter: setUserGitAuthProviders },
                newSignupFlow: { defaultValue: false, setter: setNewSignupFlow },
                linkedinConnectionForOnboarding: { defaultValue: false, setter: setLinkedinConnectionForOnboarding },
                experimentalIdes: { defaultValue: false, setter: setExperimentalIdes },
            };

            for (const [flagName, config] of Object.entries(featureFlags)) {
                const value = async () => {
                    // First check if the flag is non-default for any of the orgs
                    for (const org of orgs || []) {
                        const flagValue = await getExperimentsClient().getValueAsync(flagName, config.defaultValue, {
                            user,
                            projectId: project?.id,
                            teamId: org.id,
                            teamName: org.name,
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
                        teamId: currentOrg.data?.id,
                        teamName: currentOrg.data?.name,
                    });

                    return valueForUser;
                };

                const val = await value();
                config.setter(val);
            }
        })();
    }, [user, orgs, currentOrg, project]);

    const flags = useMemo(() => {
        return {
            startWithOptions,
            showUsageView,
            isUsageBasedBillingEnabled,
            showUseLastSuccessfulPrebuild,
            enablePersonalAccessTokens,
            usePublicApiWorkspacesService,
            oidcServiceEnabled,
            orgGitAuthProviders,
            userGitAuthProviders,
            newSignupFlow,
            linkedinConnectionForOnboarding,
            experimentalIdes,
        };
    }, [
        enablePersonalAccessTokens,
        isUsageBasedBillingEnabled,
        linkedinConnectionForOnboarding,
        newSignupFlow,
        oidcServiceEnabled,
        orgGitAuthProviders,
        showUsageView,
        showUseLastSuccessfulPrebuild,
        startWithOptions,
        usePublicApiWorkspacesService,
        userGitAuthProviders,
        experimentalIdes,
    ]);

    return <FeatureFlagContext.Provider value={flags}>{children}</FeatureFlagContext.Provider>;
};

export { FeatureFlagContext, FeatureFlagContextProvider };

export const useFeatureFlags = () => {
    return useContext(FeatureFlagContext);
};
