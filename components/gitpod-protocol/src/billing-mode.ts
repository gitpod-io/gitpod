/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/**
 * BillingMode is used to answer the following questions:
 *  - Should UI piece x be displayed for this user/team? (getBillingModeForUser/Team)
 *  - What model should be used to limit this workspace's capabilities (mayStartWorkspace, setTimeout, workspace class, etc...) (getBillingMode(workspaceInstance.attributionId))
 *  - How is a workspace session charged for? (getBillingMode(workspaceInstance.attributionId))
 */
export type BillingMode = None | Chargebee | UsageBased;
export namespace BillingMode {
    export const NONE: None = {
        mode: "none",
    };

    export function showChargebeeBilling(billingMode: BillingMode): boolean {
        if (billingMode.mode === "chargebee") {
            return true;
        }
        return false;
    }

    export function showChargebeeInvoices(billingMode: BillingMode): boolean {
        if (showChargebeeBilling(billingMode)) {
            return true;
        }
        // TODO(gpl) or hasBeenCustomer, so they can access invoices (edge case?)
        return false;
    }

    /** Incl. upgrade and status */
    export function showStripeBilling(billingMode: BillingMode): boolean {
        return (
            billingMode.mode === "usage-based" || (billingMode.mode === "chargebee" && !!billingMode.canUpgradeToUBB)
        );
    }

    export function canSetWorkspaceClass(billingMode: BillingMode): boolean {
        // if has any Stripe subscription, either directly or per team
        return billingMode.mode === "usage-based";
    }

    export function canSetCostCenter(billingMode: BillingMode): boolean {
        // if has any Stripe Subscription, either directly or per team
        return billingMode.mode === "usage-based";
    }
}

/** Payment is disabled */
interface None {
    mode: "none";
}

/** Sessions is handled with old subscription logic based on Chargebee */
interface Chargebee {
    mode: "chargebee";
    canUpgradeToUBB?: boolean;
}

/** Session is handld with new usage-based logic */
interface UsageBased {
    mode: "usage-based";
}
