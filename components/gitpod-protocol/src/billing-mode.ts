/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/**
 * BillingMode is used to answer the following questions:
 *  - Should UI piece x be displayed for this user/team?
 *  - What model should be used to limit this workspace's capabilities (mayStartWorkspace, setTimeout, workspace class, etc...)
 *  - How is a workspace session charged for?
 */
export type BillingMode =
    | None
    | ChargebeeFreeTier
    | ChargebeePaidTier
    | ChargebeePaidTierCancelled
    | UBBFreeTier
    | UBBPaidTier;

export namespace BillingMode {
    export const NONE: BillingMode = {
        mode: "none",
    };
}

/** Payment is disabled */
interface None {
    mode: "none";
}

/** Default case without any subscription, when UBB is disabled */
interface ChargebeeFreeTier {
    mode: "chargebee";
    tier: "free";
}

/** When there is _any_ paid subscription on Chargbee that's active, either personal or team based */
interface ChargebeePaidTier {
    mode: "chargebee";
    tier: "paid";
    /** All active paid plans ids */
    planIds: string[];

    /** Whether or not the user has an active personal plan */
    hasPersonalPlan?: boolean;
}

/** When there is any paid, active Chargebee subscription , that has already been cancelled, and UBB is enabled */
interface ChargebeePaidTierCancelled {
    mode: "chargebee";
    tier: "paid_cancelled_and_ubb";
    /** All active paid plans ids */
    planIds: string[];
}

/** Default case without any subscription, when UBB is enabled */
interface UBBFreeTier {
    mode: "usage-based";
    tier: "free";
}

/** When UBB is enabled and the user has a paid subscription */
interface UBBPaidTier {
    mode: "usage-based";
    tier: "paid";
}
