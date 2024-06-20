/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { getPrimaryEmail } from "@gitpod/public-api-common/lib/user-utils";
import { useQuery } from "@tanstack/react-query";
import { getExperimentsClient } from "../experiments/client";
import { useCurrentProject } from "../projects/project-context";
import { useCurrentUser } from "../user-context";
import { useCurrentOrg } from "./organizations/orgs-query";

const featureFlags = {
    oidcServiceEnabled: false,
    // Default to true to enable on gitpod dedicated until ff support is added for dedicated
    orgGitAuthProviders: true,
    userGitAuthProviders: false,
    enableDedicatedOnboardingFlow: false,
    // Local SSH feature of VS Code Desktop Extension
    gitpod_desktop_use_local_ssh_proxy: false,
    enabledOrbitalDiscoveries: "",
    repositoryFinderSearch: false,
    // dummy specified dataops feature, default false
    dataops: false,
    // Logging tracing for added for investigate hanging issue
    dashboard_logging_tracing: false,
    showBrowserExtensionPromotion: false,
    usage_update_scheduler_duration: "15m",
};

type FeatureFlags = typeof featureFlags;

export const useFeatureFlag = <K extends keyof FeatureFlags>(featureFlag: K): FeatureFlags[K] | boolean => {
    const user = useCurrentUser();
    const org = useCurrentOrg().data;
    const project = useCurrentProject().project;

    const queryKey = ["featureFlag", featureFlag, user?.id || "", org?.id || "", project?.id || ""];

    const query = useQuery(queryKey, async () => {
        const flagValue = await getExperimentsClient().getValueAsync(featureFlag, featureFlags[featureFlag], {
            user: user && {
                id: user.id,
                email: getPrimaryEmail(user),
            },
            projectId: project?.id,
            teamId: org?.id,
            teamName: org?.name,
            gitpodHost: window.location.host,
        });
        return flagValue;
    });

    return query.data !== undefined ? query.data : featureFlags[featureFlag];
};

export const useIsDataOps = () => {
    return useFeatureFlag("dataops");
};
