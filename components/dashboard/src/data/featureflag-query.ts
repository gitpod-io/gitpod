/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { getPrimaryEmail } from "@gitpod/public-api-common/lib/user-utils";
import { useQuery } from "@tanstack/react-query";
import { getExperimentsClient } from "../experiments/client";
import { useCurrentUser } from "../user-context";
import { useCurrentOrg } from "./organizations/orgs-query";
import { ClassicPaygSunsetConfig } from "@gitpod/gitpod-protocol/lib/experiments/configcat";

const defaultClassicPaygSunsetConfig: ClassicPaygSunsetConfig = { enabled: false, exemptedOrganizations: [] };

const featureFlags = {
    oidcServiceEnabled: false,
    // Default to true to enable on gitpod dedicated until ff support is added for dedicated
    orgGitAuthProviders: true,
    userGitAuthProviders: false,
    // Local SSH feature of VS Code Desktop Extension
    gitpod_desktop_use_local_ssh_proxy: false,
    enabledOrbitalDiscoveries: "",
    // dummy specified dataops feature, default false
    dataops: false,
    enable_multi_org: false,
    showBrowserExtensionPromotion: false,
    enable_experimental_jbtb: false,
    enabled_configuration_prebuild_full_clone: false,
    enterprise_onboarding_enabled: false,
    commit_annotation_setting_enabled: false,
    classic_payg_sunset_enabled: defaultClassicPaygSunsetConfig,
};

type FeatureFlags = typeof featureFlags;

// Helper to parse JSON feature flags
function parseFeatureFlagValue<T>(flagName: string, rawValue: any, defaultValue: T): T {
    // Special handling for JSON-based feature flags
    if (flagName === "classic_payg_sunset_enabled") {
        try {
            if (typeof rawValue === "string") {
                return JSON.parse(rawValue) as T;
            }
            // If it's already an object, return as-is
            if (typeof rawValue === "object" && rawValue !== null) {
                return rawValue as T;
            }
        } catch (error) {
            console.error(`Failed to parse feature flag ${flagName}:`, error);
            return defaultValue;
        }
    }
    return rawValue;
}

export const useFeatureFlag = <K extends keyof FeatureFlags>(featureFlag: K): FeatureFlags[K] | boolean => {
    const user = useCurrentUser();
    const org = useCurrentOrg().data;

    const queryKey = ["featureFlag", featureFlag, user?.id || "", org?.id || ""];

    const query = useQuery(queryKey, async () => {
        const defaultValue = featureFlags[featureFlag];
        // For JSON flags, send stringified default to ConfigCat
        const configCatDefault =
            featureFlag === "classic_payg_sunset_enabled" ? JSON.stringify(defaultValue) : defaultValue;

        const rawValue = await getExperimentsClient().getValueAsync(featureFlag, configCatDefault, {
            user: user && {
                id: user.id,
                email: getPrimaryEmail(user),
            },
            teamId: org?.id,
            teamName: org?.name,
            gitpodHost: window.location.host,
        });

        return parseFeatureFlagValue(featureFlag, rawValue, defaultValue);
    });

    return query.data !== undefined ? query.data : featureFlags[featureFlag];
};

export const useIsDataOps = () => {
    return useFeatureFlag("dataops");
};
