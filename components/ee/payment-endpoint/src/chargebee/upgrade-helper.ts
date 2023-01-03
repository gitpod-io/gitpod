/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { ChargebeeProvider } from "./chargebee-provider";
import { Chargebee as chargebee } from "./chargebee-types";
import { LogContext, log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class UpgradeHelper {
    @inject(ChargebeeProvider) protected readonly chargebeeProvider: ChargebeeProvider;

    /**
     * Uses subscription.add_charge_at_term_end to 'manually' add a charge to the given Chargebee Subscription
     * (see https://apidocs.chargebee.com/docs/api/subscriptions#add_charge_at_term_end)
     *
     * @param userId
     * @param chargebeeSubscriptionId
     * @param amountInCents
     * @param description
     * @param upgradeTimestamp
     */
    async chargeForUpgrade(
        userId: string,
        chargebeeSubscriptionId: string,
        amountInCents: number,
        description: string,
        upgradeTimestamp: string,
    ) {
        const logContext: LogContext = { userId };
        const logPayload = {
            chargebeeSubscriptionId: chargebeeSubscriptionId,
            amountInCents,
            description,
            upgradeTimestamp,
        };

        await new Promise<void>((resolve, reject) => {
            log.info(logContext, "Charge on Upgrade: Upgrade detected.", logPayload);
            this.chargebeeProvider.subscription
                .add_charge_at_term_end(chargebeeSubscriptionId, {
                    amount: amountInCents,
                    description,
                })
                .request(function (error: any, result: any) {
                    if (error) {
                        log.error(logContext, "Charge on Upgrade: error", error, logPayload);
                        reject(error);
                    } else {
                        log.info(logContext, "Charge on Upgrade: successful", logPayload);
                        resolve();
                    }
                });
        });
    }

    // Returns a ratio between 0 and 1:
    //     0 means we've just finished the term
    //     1 means we still have the entire term left
    getCurrentTermRemainingRatio(chargebeeSubscription: chargebee.Subscription): number {
        if (!chargebeeSubscription.next_billing_at) {
            throw new Error("subscription.next_billing_at must be set.");
        }
        const now = new Date();
        const nextBilling = new Date(chargebeeSubscription.next_billing_at * 1000);
        const remainingMs = nextBilling.getTime() - now.getTime();

        const getBillingCycleMs = (unit: chargebee.BillingPeriodUnit): number => {
            const previousBilling = new Date(nextBilling.getTime());
            switch (unit) {
                case "day":
                    previousBilling.setDate(nextBilling.getDate() - 1);
                    break;
                case "week":
                    previousBilling.setDate(nextBilling.getDate() - 7);
                    break;
                case "month":
                    previousBilling.setMonth(nextBilling.getMonth() - 1);
                    break;
                case "year":
                    previousBilling.setFullYear(nextBilling.getFullYear() - 1);
                    break;
            }
            return nextBilling.getTime() - previousBilling.getTime();
        };

        const billingCycleMs =
            typeof chargebeeSubscription.billing_period === "number" && chargebeeSubscription.billing_period_unit
                ? chargebeeSubscription.billing_period * getBillingCycleMs(chargebeeSubscription.billing_period_unit)
                : 1 * getBillingCycleMs("month");

        return remainingMs / billingCycleMs;
    }
}
