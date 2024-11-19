/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import Stripe from "stripe";
import * as grpc from "@grpc/grpc-js";
import { Config } from "../config";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import {
    observeStripeClientRequestsCompleted,
    stripeClientRequestsCompletedDurationSeconds,
} from "../prometheus-metrics";
import { BillingServiceClient, BillingServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/billing.pb";
import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";

@injectable()
export class StripeService {
    constructor(
        @inject(Config) private readonly config: Config,
        @inject(BillingServiceDefinition.name)
        private readonly billingService: BillingServiceClient,
    ) {}

    private _stripe: Stripe | undefined;

    private getStripe(): Stripe {
        if (!this._stripe) {
            if (!this.config.stripeSecrets?.secretKey) {
                throw new Error("Stripe is not properly configured");
            }
            this._stripe = new Stripe(this.config.stripeSecrets.secretKey, { apiVersion: "2024-04-10" });
        }
        return this._stripe;
    }

    async findCustomerByAttributionId(attributionId: string): Promise<string | undefined> {
        try {
            const resp = await this.billingService.getStripeCustomer({ attributionId });
            return resp.customer?.id;
        } catch (e) {
            if (e.code === grpc.status.NOT_FOUND) {
                return undefined;
            }

            log.error("Failed to get stripe customer", e, { attributionId });
            throw e;
        }
    }

    async getPortalUrlForAttributionId(attributionId: string, returnUrl: string): Promise<string> {
        const customerId = await this.findCustomerByAttributionId(attributionId);
        if (!customerId) {
            throw new ApplicationError(
                ErrorCodes.NOT_FOUND,
                `No Stripe Customer ID for attribution ID '${attributionId}'`,
            );
        }
        const session = await reportStripeOutcome("portal_create_session", () => {
            return this.getStripe().billingPortal.sessions.create({
                customer: customerId,
                return_url: returnUrl,
            });
        });
        return session.url;
    }

    async findUncancelledSubscriptionByAttributionId(attributionId: string): Promise<string | undefined> {
        const customerId = await this.findCustomerByAttributionId(attributionId);
        if (!customerId) {
            return undefined;
        }
        const result = await reportStripeOutcome("subscriptions_list", () => {
            return this.getStripe().subscriptions.list({
                customer: customerId,
            });
        });
        if (result.data.length > 1) {
            log.error(`Stripe customer has more than one subscription!`, {
                attributionId,
                customerId,
                subscriptions: result.data.map((s) => s.id),
            });
        }
        return result.data[0]?.id;
    }

    /**
     * Cancels every subscription belonging to an `attributionId`
     * @see https://docs.stripe.com/api/subscriptions/list & https://docs.stripe.com/api/subscriptions/cancel
     */
    async cancelCustomerSubscriptions(attributionId: AttributionId): Promise<void> {
        await reportStripeOutcome("subscriptions_cancel", async () => {
            const stripe = this.getStripe();

            const customer = await this.findCustomerByAttributionId(AttributionId.render(attributionId));
            const activeSubscriptions = await stripe.subscriptions.list({ customer });

            for (const subscription of activeSubscriptions.data) {
                await stripe.subscriptions.cancel(subscription.id);
            }
        });
    }

    async getPriceInformation(attributionId: string): Promise<string> {
        const priceInformation = await this.billingService.getPriceInformation({ attributionId });
        return priceInformation.humanReadableDescription;
    }

    public async updateAttributionId(
        stripeCustomerId: string,
        newAttributionId: string,
        oldAttributionId: string,
    ): Promise<boolean> {
        if (stripeCustomerId.length === 0) {
            throw new Error(`Cannot update Stripe customer with empty stripeCustomerId`);
        }
        if (newAttributionId.length === 0) {
            throw new Error(`Cannot update Stripe customer with empty newAttributionId`);
        }
        if (oldAttributionId.length === 0) {
            throw new Error(`Cannot update Stripe customer with empty oldAttributionId`);
        }
        const result = await this.getStripe().customers.search({
            query: `metadata['attributionId']:'${oldAttributionId}'`,
        });
        if (result.data.length > 0) {
            for (const customer of result.data) {
                if (customer.id !== stripeCustomerId) {
                    log.error(`Found unexpected Stripe customer with old attribution ID`, {
                        oldAttributionId,
                        newAttributionId,
                        expectedStripeCustomerId: stripeCustomerId,
                        actualStripeCustomerId: customer.id,
                    });
                }
            }
        } else {
            log.info(`No Stripe customer found for old attribution ID`, { oldAttributionId, stripeCustomerId });
            return false;
        }
        log.info(`Updating Stripe customer in stripe`, {
            oldAttributionId,
            newAttributionId,
            stripeCustomerId,
        });
        await this.getStripe().customers.update(stripeCustomerId, {
            metadata: {
                attributionId: newAttributionId,
            },
        });
        return true;
    }
}

async function reportStripeOutcome<T>(op: string, f: () => Promise<T>) {
    const timer = stripeClientRequestsCompletedDurationSeconds.startTimer();
    let outcome = "ok";
    try {
        return await f();
    } catch (e) {
        outcome = e.type || "unknown";
        throw e;
    } finally {
        observeStripeClientRequestsCompleted(op, outcome, timer());
    }
}
