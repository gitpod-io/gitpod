/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { useQueryParams } from "../hooks/use-query-params";
import { getGitpodService } from "../service/service";
import { useFeatureFlag } from "../data/featureflag-query";

const FORCE_SETUP_PARAM = "dedicated-setup";
const FORCE_SETUP_PARAM_VALUE = "force";

export const useCheckDedicatedSetup = () => {
    const params = useQueryParams();
    const { data: onboardingState, isLoading } = useOnboardingState();
    const enableDedicatedOnboardingFlow = useFeatureFlag("enableDedicatedOnboardingFlow");

    const forceSetup = params.get(FORCE_SETUP_PARAM) === FORCE_SETUP_PARAM_VALUE;
    const needsOnboarding = onboardingState?.isCompleted !== true;

    return {
        // Feature flag must be on
        // Either setup forced via query param, or onboarding state is not completed
        showOnboarding: enableDedicatedOnboardingFlow && (forceSetup || needsOnboarding),
        isLoading,
    };
};

export const useOnboardingState = () => {
    const enableDedicatedOnboardingFlow = useFeatureFlag("enableDedicatedOnboardingFlow");

    return useQuery(
        ["onboarding-state"],
        async () => {
            return getGitpodService().server.getOnboardingState();
        },
        {
            // TODO: determine if this is helpful to cache longer
            staleTime: 1000 * 60 * 60 * 1, // 1h
            cacheTime: 1000 * 60 * 60 * 1, // 1h
            // Only query if feature flag is enabled
            enabled: enableDedicatedOnboardingFlow,
        },
    );
};
