/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { useFeatureFlag } from "../data/featureflag-query";
import { useCurrentUser } from "../user-context";
import { useQueryParams } from "../hooks/use-query-params";
import { FORCE_ONBOARDING_PARAM, FORCE_ONBOARDING_PARAM_VALUE } from "./UserOnboarding";

export const useShowUserOnboarding = () => {
    const user = useCurrentUser();
    const search = useQueryParams();
    const newSignupFlow = useFeatureFlag("newSignupFlow");

    if (!user || User.isOrganizationOwned(user)) {
        return false;
    }

    // Show new signup flow if:
    // * feature flag enabled
    // * User is onboarding (no ide selected yet) OR query param `onboarding=force` is set
    const showUserOnboarding =
        newSignupFlow &&
        (User.isOnboardingUser(user) || search.get(FORCE_ONBOARDING_PARAM) === FORCE_ONBOARDING_PARAM_VALUE);

    return showUserOnboarding;
};
