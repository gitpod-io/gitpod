/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, lazy } from "react";
import { User } from "@gitpod/gitpod-protocol";
import { useCheckDedicatedSetup } from "../hooks/use-check-dedicated-setup";
import { useQueryParams } from "../hooks/use-query-param";
import { useCurrentUser } from "../user-context";
import { FORCE_ONBOARDING_PARAM, FORCE_ONBOARDING_PARAM_VALUE } from "../onboarding/UserOnboarding";
import { useFeatureFlag } from "../data/featureflag-query";

const UserOnboarding = lazy(() => import(/* webpackPrefetch: true */ "../onboarding/UserOnboarding"));
const DedicatedOnboarding = lazy(() => import(/* webpackPrefetch: true */ "../dedicated-setup/DedicatedSetup"));

export const AppBlockingFlows: FC = ({ children }) => {
    const user = useCurrentUser();
    const checkDedicatedOnboaring = useCheckDedicatedSetup();
    const newSignupFlow = useFeatureFlag("newSignupFlow");
    const search = useQueryParams();

    // This shouldn't happen, but if it does don't render anything yet
    if (!user) {
        return <></>;
    }

    // Handle dedicated onboarding if necessary
    if (!checkDedicatedOnboaring.isLoading && checkDedicatedOnboaring.needsOnboarding) {
        return <DedicatedOnboarding />;
    }

    // Show new signup flow if:
    // * feature flag enabled
    // * User is onboarding (no ide selected yet) OR query param `onboarding=force` is set
    const showNewSignupFlow =
        newSignupFlow &&
        (User.isOnboardingUser(user) || search.get(FORCE_ONBOARDING_PARAM) === FORCE_ONBOARDING_PARAM_VALUE);
    if (showNewSignupFlow) {
        return <UserOnboarding user={user} />;
    }

    return <>{children}</>;
};
