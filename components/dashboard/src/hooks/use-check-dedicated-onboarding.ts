/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useAuthProviders } from "../data/auth-providers/auth-provider-query";
import { useOrganizations } from "../data/organizations/orgs-query";
import { useQueryParams } from "./use-query-param";

const FORCE_ONBOARDING_PARAM = "dedicated-onboarding";
const FORCE_ONBOARDING_PARAM_VALUE = "force";

export const useCheckDedicatedOnboarding = () => {
    const orgs = useOrganizations();
    const authProviders = useAuthProviders();
    const params = useQueryParams();

    const forceOnboarding = params.get(FORCE_ONBOARDING_PARAM) === FORCE_ONBOARDING_PARAM_VALUE;

    const hasOrgs = (orgs.data || [])?.length > 0;
    const hasAuthProviders = (authProviders.data || []).length > 0;

    // If user belongs to no orgs or there are no auth providers, or flow is force w/ query param, show onboarding
    return {
        needsOnboarding: !hasOrgs || !hasAuthProviders || forceOnboarding,
        isLoading: orgs.isLoading || authProviders.isLoading,
    };
};
