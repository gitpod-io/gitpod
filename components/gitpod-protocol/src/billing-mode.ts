/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/**
 * BillingMode is used to answer the following questions:
 *  - Should UI piece x be displayed for this user/team? (getBillingModeForUser/Team)
 *  - What model should be used to limit this workspace's capabilities (mayStartWorkspace, setTimeout, workspace class, etc...) (getBillingMode(workspaceInstance.attributionId))
 *  - How is a workspace session charged for? (getBillingMode(workspaceInstance.attributionId))
 */
export type BillingMode = None | UsageBased;
export namespace BillingMode {
    export const NONE: None = {
        mode: "none",
    };

    /** Incl. upgrade and status */
    export function showUsageBasedBilling(billingMode?: BillingMode): boolean {
        return billingMode?.mode === "usage-based";
    }

    export function canSetCostCenter(billingMode: BillingMode): boolean {
        return billingMode.mode === "usage-based";
    }
}

/** Payment is disabled */
interface None {
    mode: "none";
}

/** Session is handld with new usage-based logic */
interface UsageBased {
    mode: "usage-based";

    /** True if the org has a paid plan. */
    paid: boolean;
}
