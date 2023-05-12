/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { useFeatureFlag } from "../data/featureflag-query";
import { noPersistence } from "../data/setup";
import { getGitpodService } from "../service/service";

/**
 * @description Returns a flage stating if the current installation still needs setup before it can be used. Also returns an isLoading indicator as the check is async
 */
export const useNeedsSetup = () => {
    const { data: onboardingState, isLoading } = useOnboardingState();
    const enableDedicatedOnboardingFlow = useFeatureFlag("enableDedicatedOnboardingFlow");

    let needsSetup = (onboardingState?.isCompleted ?? false) !== true;

    if (isCurrentHostExcludedFromSetup()) {
        needsSetup = false;
    }

    return {
        needsSetup: enableDedicatedOnboardingFlow && needsSetup,
        isLoading: enableDedicatedOnboardingFlow && isLoading,
    };
};

const useOnboardingState = () => {
    const enableDedicatedOnboardingFlow = useFeatureFlag("enableDedicatedOnboardingFlow");

    return useQuery(
        noPersistence(["onboarding-state"]),
        async () => {
            return await getGitpodService().server.getOnboardingState();
        },
        {
            // Cache for a bit so we can avoid having the value change before we're ready
            staleTime: 1000 * 60 * 60 * 1, // 1h
            cacheTime: 1000 * 60 * 60 * 1, // 1h
            // Only query if feature flag is enabled
            enabled: enableDedicatedOnboardingFlow,
        },
    );
};

// TODO: This is a temporary safety-gurad against this flow showing up on gitpod.io
// We can remove this once we've ensured we're distinguishing different installation types for this
export const isCurrentHostExcludedFromSetup = () => {
    // Purposely not using isGitpodIo() check here to avoid disabling on preview environments too.
    return ["gitpod.io", "gitpod-staging.com"].includes(window.location.hostname);
};
