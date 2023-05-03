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
    // const [loading, setLoading] = useState(true);
    // const [areShowing, setAreShowing] = useState(false);
    const [inProgress, setInProgress] = useState(false);
    const [hasCompleted, setHasCompleted] = useState(false);

    const enableDedicatedOnboardingFlow = useFeatureFlag("enableDedicatedOnboardingFlow");
    const params = useQueryParams();

    const { data: onboardingState, isLoading } = useOnboardingState();
    // console.log("enableDedicatedOnboardingFlow", enableDedicatedOnboardingFlow);

    const forceSetup = params.get(FORCE_SETUP_PARAM) === FORCE_SETUP_PARAM_VALUE;
    const needsOnboarding = forceSetup || onboardingState?.isCompleted !== true;

    // const markInProgress = useCallback(() => setHasCompleted(true), []);
    // const markCompleted = useCallback(() => setHasCompleted(true), []);
    const markCompleted = useCallback(() => setInProgress(false), []);

    // If needsOnboarding changes to true, we want to set flow as in progress
    // This helps us not close the flow prematurely (i.e. onboardingState.completed = true but we want to show the completed page)
    useEffect(() => {
        if (needsOnboarding && !inProgress) {
            setInProgress(true);
        }
    }, [inProgress, needsOnboarding]);

    // We want to check once up front if we need to show the setup flow
    // Once we've decided, we don't want to rely on derived state to determine it anymore
    // so we can avoid any flashing of the setup flow as it progresses and we need to do things
    // like re-fetch orgs after creation, or update signed in user
    // useEffect(() => {
    //     console.log("running getOnboardingState effect");
    //     getGitpodService()
    //         .server.getOnboardingState()
    //         .then((state) => {
    //             console.log("getOnboardingState", state, enableDedicatedOnboardingFlow);
    //             const forceSetup = params.get(FORCE_SETUP_PARAM) === FORCE_SETUP_PARAM_VALUE;
    //             const needsOnboarding = state.isCompleted !== true;
    //             setAreShowing(enableDedicatedOnboardingFlow && (forceSetup || needsOnboarding));
    //             setLoading(false);
    //         });
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, []);

    return {
        // Feature flag must be on
        // Either setup forced via query param, or onboarding state is not completed
        // Also don't show if we've marked it as completed (user finished last step)
        showOnboarding: enableDedicatedOnboardingFlow && inProgress,
        // showOnboarding: areShowing && !hasCompleted,
        isLoading: enableDedicatedOnboardingFlow && isLoading,
        // isLoading: loading,
        markCompleted,
        // markInProgress,
    };
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
