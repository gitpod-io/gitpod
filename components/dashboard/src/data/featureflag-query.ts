/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getExperimentsClient } from "../experiments/client";
import { useCurrentProject } from "../projects/project-context";
import { useCurrentUser } from "../user-context";
import { useCurrentOrg } from "./organizations/orgs-query";

const featureFlags = {
    showUseLastSuccessfulPrebuild: false,
    publicApiExperimentalWorkspaceService: false,
    personalAccessTokensEnabled: false,
    oidcServiceEnabled: false,
    // Default to true to enable on gitpod dedicated until ff support is added for dedicated
    orgGitAuthProviders: true,
    userGitAuthProviders: false,
    linkedinConnectionForOnboarding: false,
    enableDedicatedOnboardingFlow: false,
    phoneVerificationByCall: false,
    doRetryUserLoader: true,
    // Local SSH feature of VS Code Desktop Extension
    gitpod_desktop_use_local_ssh_proxy: false,
    supervisor_live_git_status: false,
    enabledOrbitalDiscoveries: "",
    newProjectIncrementalRepoSearchBBS: false,
    includeProjectsOnCreateWorkspace: false,
    repositoryFinderSearch: false,
};

type FeatureFlags = typeof featureFlags;

export const useFeatureFlag = <K extends keyof FeatureFlags>(featureFlag: K): FeatureFlags[K] | boolean => {
    const user = useCurrentUser();
    const org = useCurrentOrg().data;
    const project = useCurrentProject().project;

    const queryKey = ["featureFlag", featureFlag, user?.id || "", org?.id || "", project?.id || ""];

    const query = useQuery(queryKey, async () => {
        const flagValue = await getExperimentsClient().getValueAsync(featureFlag, featureFlags[featureFlag], {
            user,
            projectId: project?.id,
            teamId: org?.id,
            teamName: org?.name,
            gitpodHost: window.location.host,
        });
        return flagValue;
    });

    return query.data !== undefined ? query.data : featureFlags[featureFlag];
};
