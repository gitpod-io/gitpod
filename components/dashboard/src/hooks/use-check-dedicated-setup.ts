/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useAuthProviders } from "../data/auth-providers/auth-provider-query";
import { useFeatureFlag } from "../data/featureflag-query";
import { useOrganizations } from "../data/organizations/orgs-query";
import { useQueryParams } from "./use-query-param";

const FORCE_SETUP_PARAM = "dedicated-setup";
const FORCE_SETUP_PARAM_VALUE = "force";

export const useCheckDedicatedSetup = () => {
    const orgs = useOrganizations();
    const authProviders = useAuthProviders();
    const params = useQueryParams();
    const enableDedicatedOnboardingFlow = useFeatureFlag("enableDedicatedOnboardingFlow");

    const forceSetup = params.get(FORCE_SETUP_PARAM) === FORCE_SETUP_PARAM_VALUE;

    const hasOrgs = (orgs.data || [])?.length > 0;
    const hasAuthProviders = (authProviders.data || []).length > 0;

    // Show setup if:
    // - query param set to force
    // - or
    // - feature flag is on and either no orgs or no auth providers
    return {
        needsOnboarding: forceSetup || (enableDedicatedOnboardingFlow && (!hasOrgs || !hasAuthProviders)),
        isLoading: orgs.isLoading || authProviders.isLoading,
    };
};
