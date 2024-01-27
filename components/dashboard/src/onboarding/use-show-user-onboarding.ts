/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCurrentUser } from "../user-context";
import { useQueryParams } from "../hooks/use-query-params";
import { FORCE_ONBOARDING_PARAM, FORCE_ONBOARDING_PARAM_VALUE } from "./UserOnboarding";
import { isOrganizationOwned } from "@gitpod/public-api-common/lib/user-utils";
import { User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";

export const useShowUserOnboarding = () => {
    const user = useCurrentUser();
    const search = useQueryParams();

    if (!user || isOrganizationOwned(user)) {
        return false;
    }

    // Show new signup flow if:
    // * User is onboarding (no ide selected yet, not org user, hasn't onboarded before)
    // * OR query param `onboarding=force` is set
    const showUserOnboarding =
        isOnboardingUser(user) || search.get(FORCE_ONBOARDING_PARAM) === FORCE_ONBOARDING_PARAM_VALUE;

    return showUserOnboarding;
};

export function hasPreferredIde(user: User) {
    return !!user?.editorSettings?.name || !!user?.editorSettings?.version;
}

export function isOnboardingUser(user: User) {
    if (isOrganizationOwned(user)) {
        return false;
    }
    // If a user has already been onboarded
    // Also, used to rule out "admin-user"
    if (!!user.profile?.onboardedTimestamp) {
        return false;
    }
    return !hasPreferredIde(user);
}
