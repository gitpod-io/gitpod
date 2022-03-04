/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

 export namespace PaymentProtocol {
    export const UPDATE_GITPOD_SUBSCRIPTION_PATH = '/payment/chargebee'
}

export interface PlanCoupon {
    chargebeePlanID: string;
    newPrice: number;
    description: string;
}

export interface GithubUpgradeURL {
    url: string;
    planID: number;
}
