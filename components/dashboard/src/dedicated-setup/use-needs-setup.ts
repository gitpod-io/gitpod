/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { noPersistence } from "../data/setup";
import { installationClient } from "../service/public-api";
import { GetOnboardingStateRequest } from "@gitpod/public-api/lib/gitpod/v1/installation_pb";
import { useInstallationConfiguration } from "../data/installation/installation-config-query";

/**
 * @description Returns a flag stating if the current installation still needs setup before it can be used. Also returns an isLoading indicator as the check is async
 */
export const useNeedsSetup = () => {
    const { data: onboardingState, isLoading } = useOnboardingState();
    const { data: installationConfig } = useInstallationConfiguration();
    const isDedicatedInstallation = !!installationConfig?.isDedicatedInstallation;

    // This needs to only be true if we've loaded the onboarding state
    let needsSetup = !isLoading && onboardingState && onboardingState.completed !== true;

    if (isCurrentHostExcludedFromSetup()) {
        needsSetup = false;
    }

    return {
        needsSetup: isDedicatedInstallation && needsSetup,
        // disabled queries stay in `isLoading` state, so checking feature flag here too
        isLoading: isDedicatedInstallation && isLoading,
    };
};

export const useOnboardingState = () => {
    const { data: installationConfig } = useInstallationConfiguration();

    return useQuery(
        noPersistence(["onboarding-state"]),
        async () => {
            const response = await installationClient.getOnboardingState(new GetOnboardingStateRequest());
            return response.onboardingState!;
        },
        {
            // Only query if feature flag is enabled
            enabled: !!installationConfig?.isDedicatedInstallation,
        },
    );
};

// TODO: This is a temporary safety-guard against this flow showing up on gitpod.io
// We can remove this once we've ensured we're distinguishing different installation types for this
export const isCurrentHostExcludedFromSetup = () => {
    // Purposely not using isGitpodIo() check here to avoid disabling on preview environments too.
    return ["gitpod.io", "gitpod-staging.com"].includes(window.location.hostname);
};
