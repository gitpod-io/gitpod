/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { useQueryParams } from "../hooks/use-query-params";
import { getGitpodService } from "../service/service";
import { useFeatureFlag } from "../data/featureflag-query";
import { useCallback, useEffect, useState } from "react";
import { noPersistence } from "../data/setup";

const FORCE_SETUP_PARAM = "dedicated-setup";
const FORCE_SETUP_PARAM_VALUE = "force";

export const useCheckDedicatedSetup = () => {
    // track if user has finished onboarding so we avoid showing the onboarding
    // again in case onboarding state doesn't updated right away
    const [inProgress, setInProgress] = useState(false);

    const enableDedicatedOnboardingFlow = useFeatureFlag("enableDedicatedOnboardingFlow");
    const params = useQueryParams();

    const { data: onboardingState, isLoading } = useOnboardingState();

    const forceSetup = forceDedicatedSetupParam(params);
    let needsOnboarding = forceSetup || (onboardingState && onboardingState.isCompleted !== true);

    // TODO: This is a temporary safety-gurad against this flow showing up on gitpod.io
    // We can remove this once we've ensured we're distinguishing different installation types for this
    // Purposely not using isGitpodIo() check here to avoid disabling on preview environments too.
    if (window.location.hostname === "gitpod.io") {
        needsOnboarding = false;
    }

    const markCompleted = useCallback(() => setInProgress(false), []);

    // If needsOnboarding changes to true, we want to set flow as in progress
    // This helps us not close the flow prematurely (i.e. onboardingState.completed = true but we want to show the completed page)
    useEffect(() => {
        if (enableDedicatedOnboardingFlow && needsOnboarding && !inProgress) {
            setInProgress(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enableDedicatedOnboardingFlow, forceSetup, needsOnboarding]);

    return {
        showOnboarding: inProgress,
        isLoading: enableDedicatedOnboardingFlow && isLoading,
        markCompleted,
    };
};

export const forceDedicatedSetupParam = (params: URLSearchParams) => {
    return params.get(FORCE_SETUP_PARAM) === FORCE_SETUP_PARAM_VALUE;
};

export const useOnboardingState = () => {
    const enableDedicatedOnboardingFlow = useFeatureFlag("enableDedicatedOnboardingFlow");

    return useQuery(
        noPersistence(["onboarding-state"]),
        async () => {
            return getGitpodService().server.getOnboardingState();
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
