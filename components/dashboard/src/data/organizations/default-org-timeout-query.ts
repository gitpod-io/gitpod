/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WORKSPACE_TIMEOUT_DEFAULT_LONG, WORKSPACE_TIMEOUT_DEFAULT_SHORT } from "@gitpod/gitpod-protocol";
import { useOrgBillingMode } from "../billing-mode/org-billing-mode-query";

/**
 * Returns the default workspace timeout for an organization based on their billing mode (does not take into account the organization's own settings)
 */
export const useDefaultOrgTimeoutQuery = () => {
    const { data: billingMode } = useOrgBillingMode();

    const isPaidOrDedicated =
        billingMode?.mode === "none" || (billingMode?.mode === "usage-based" && billingMode?.paid);

    return isPaidOrDedicated ? WORKSPACE_TIMEOUT_DEFAULT_LONG : WORKSPACE_TIMEOUT_DEFAULT_SHORT;
};
