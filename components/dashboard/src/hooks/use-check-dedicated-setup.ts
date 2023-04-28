/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useFeatureFlag } from "../data/featureflag-query";
import { useOrganizations } from "../data/organizations/orgs-query";
import { useQueryParams } from "./use-query-param";

const FORCE_SETUP_PARAM = "dedicated-setup";
const FORCE_SETUP_PARAM_VALUE = "force";

export const useCheckDedicatedSetup = () => {
    const orgs = useOrganizations();
    const params = useQueryParams();
    const enableDedicatedOnboardingFlow = useFeatureFlag("enableDedicatedOnboardingFlow");

    const forceSetup = params.get(FORCE_SETUP_PARAM) === FORCE_SETUP_PARAM_VALUE;

    const hasOrgs = (orgs.data || [])?.length > 0;

    // Show setup if:
    // - query param set to force
    // - or
    // - feature flag is on and no orgs present for user
    // TODO: update this once a new backend method is ready that will let us know if dedicated setup is needed
    return {
        needsOnboarding: forceSetup || (enableDedicatedOnboardingFlow && !hasOrgs),
        isLoading: orgs.isLoading,
    };
};
