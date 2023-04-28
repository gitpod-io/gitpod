/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQueryParams } from "./use-query-param";

const FORCE_SETUP_PARAM = "dedicated-setup";
const FORCE_SETUP_PARAM_VALUE = "force";

export const useCheckDedicatedSetup = () => {
    const params = useQueryParams();

    const forceSetup = params.get(FORCE_SETUP_PARAM) === FORCE_SETUP_PARAM_VALUE;

    // For now to aid dev only show if query param is set
    // TODO: update this once a new backend method is ready that will let us know if dedicated setup is needed
    return {
        needsOnboarding: forceSetup,
        isLoading: false,
    };
};
