/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Attributes } from "@gitpod/gitpod-protocol/lib/experiments/types";
import { getExperimentsClient } from "./client";

export const featureFlags = {
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
    websocket_url_provider_returns_immediately: true,
};

export type FeatureFlags = typeof featureFlags;

export const getFeatureFlagValue = <K extends keyof FeatureFlags>(
    featureFlag: K,
    attributes: Attributes,
): Promise<typeof featureFlags[K]> => {
    return getExperimentsClient().getValueAsync(featureFlag, featureFlags[featureFlag], attributes);
};
