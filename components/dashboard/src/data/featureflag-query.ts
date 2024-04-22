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
    enabledOrbitalDiscoveries: "",
    newProjectIncrementalRepoSearchBBS: false,
    repositoryFinderSearch: false,
    createProjectModal: false,
    configurationsAndPrebuilds: false,
    showPrebuildsMenuItem: false,
    // Whether to enable workspace class restrictions for configurations
    configuration_workspace_class_restrictions: false,
    org_level_editor_restriction_enabled: false,
    org_level_editor_version_pinning_enabled: false,
    // dummy specified dataops feature, default false
    dataops: false,
    // Logging tracing for added for investigate hanging issue
    dashboard_logging_tracing: false,
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

export const useDedicatedFeatureFlag = <K extends keyof FeatureFlags>(featureFlag: K): FeatureFlags[K] | boolean => {
    const queryKey = ["dedicatedFeatureFlag", featureFlag];

    const query = useQuery(queryKey, async () => {
        const flagValue = await getExperimentsClient().getValueAsync(featureFlag, featureFlags[featureFlag], {
            gitpodHost: window.location.host,
        });
        return flagValue;
    });

    return query.data !== undefined ? query.data : featureFlags[featureFlag];
};

export const useIsDataOps = () => {
    return useFeatureFlag("dataops");
};

export const useHasConfigurationsAndPrebuildsEnabled = () => {
    return useFeatureFlag("configurationsAndPrebuilds");
};

export const useReportDashboardLoggingTracing = () => {
    const enabled = useDedicatedFeatureFlag("dashboard_logging_tracing");

    if (!enabled) {
        return async <T>(fn: () => Promise<T>, _msg: string, _meta?: Record<string, any>) => {
            return await fn();
        };
    }
    return async <T>(fn: () => Promise<T>, msg: string, meta?: Record<string, any>) => {
        try {
            const result = await fn();
            console.error("[dashboard_tracing] " + msg, {
                ...meta,
                time: performance.now(),
            });
            return result;
        } catch (err) {
            console.error("[dashboard_tracing] " + msg, {
                ...meta,
                err: err.toString(),
                errorCode: (err as any)?.code,
                time: performance.now(),
            });
            throw err;
        }
    };
};
