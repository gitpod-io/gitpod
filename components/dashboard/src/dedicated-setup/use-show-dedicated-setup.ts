/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQueryParams } from "../hooks/use-query-params";
import { useCallback, useState } from "react";
import { isCurrentHostExcludedFromSetup, useNeedsSetup } from "./use-needs-setup";
import { useInstallationConfiguration } from "../data/installation/installation-config-query";

const FORCE_SETUP_PARAM = "dedicated-setup";
const FORCE_SETUP_PARAM_VALUE = "force";

/**
 *
 * @description Determines if current user should be shown the dedicated setup flow
 */
export const useShowDedicatedSetup = () => {
    // track if user has finished onboarding so we avoid showing the onboarding
    // again in case onboarding state isn't updated right away
    const [inProgress, setInProgress] = useState(false);

    const { data: installationConfig } = useInstallationConfiguration();
    const enableDedicatedOnboardingFlow = !!installationConfig?.isDedicatedInstallation;
    const params = useQueryParams();

    const { needsSetup } = useNeedsSetup();

    const forceSetup = forceDedicatedSetupParam(params);
    let showSetup = forceSetup || needsSetup;

    if (isCurrentHostExcludedFromSetup()) {
        showSetup = false;
    }

    const markCompleted = useCallback(() => setInProgress(false), []);

    // Update to inProgress if we should show the setup flow and we aren't
    if (enableDedicatedOnboardingFlow && showSetup && !inProgress) {
        setInProgress(true);
    }

    return {
        showSetup: inProgress,
        markCompleted,
    };
};

export const forceDedicatedSetupParam = (params: URLSearchParams) => {
    return params.get(FORCE_SETUP_PARAM) === FORCE_SETUP_PARAM_VALUE;
};
