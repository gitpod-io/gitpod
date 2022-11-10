/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { inject, injectable } from "inversify";
import Stripe from "stripe";
import * as grpc from "@grpc/grpc-js";
import { Config } from "../../../src/config";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import {
    observeStripeClientRequestsCompleted,
    stripeClientRequestsCompletedDurationSeconds,
} from "../../../src/prometheus-metrics";
import { BillingServiceClient, BillingServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/billing.pb";

@injectable()
export class StripeService {
    @inject(Config) protected readonly config: Config;

    protected _stripe: Stripe | undefined;

    @inject(BillingServiceDefinition.name)
    protected readonly billingService: BillingServiceClient;

    protected getStripe(): Stripe {
        if (!this._stripe) {
            if (!this.config.stripeSecrets?.secretKey) {
                throw new Error("Stripe is not properly configured");
            }
            this._stripe = new Stripe(this.config.stripeSecrets.secretKey, { apiVersion: "2020-08-27" });
        }
        return this._stripe;
    }

    async createSetupIntent(): Promise<Stripe.SetupIntent> {
        return await reportStripeOutcome("intent_setup", () => {
            return this.getStripe().setupIntents.create({ usage: "on_session" });
        });
    }

    async findCustomerByAttributionId(attributionId: string): Promise<string | undefined> {
        try {
            const resp = await this.billingService.getStripeCustomer({ attributionId: attributionId });
            return resp.customer?.id;
        } catch (e) {
            if (e.code === grpc.status.NOT_FOUND) {
                return undefined;
            }

            log.error("Failed to get stripe customer", e, { attributionId });
            throw e;
        }
    }

    async setDefaultPaymentMethodForCustomer(customerId: string, setupIntentId: string): Promise<void> {
        const setupIntent = await reportStripeOutcome("intent_retrieve", () => {
            return this.getStripe().setupIntents.retrieve(setupIntentId);
        });

        if (typeof setupIntent.payment_method !== "string") {
            throw new Error("The provided Stripe SetupIntent does not have a valid payment method attached");
        }
        const intentPaymentMethod = setupIntent.payment_method as string;
        // Attach the provided payment method to the customer
        await reportStripeOutcome("payment_methods_attach", () => {
            return this.getStripe().paymentMethods.attach(intentPaymentMethod, {
                customer: customerId,
            });
        });

        const paymentMethod = await reportStripeOutcome("payment_methods_get", () => {
            return this.getStripe().paymentMethods.retrieve(intentPaymentMethod);
        });

        await reportStripeOutcome("customers_update", () => {
            return this.getStripe().customers.update(customerId, {
                invoice_settings: { default_payment_method: intentPaymentMethod },
                ...(paymentMethod.billing_details.address?.country
                    ? { address: { line1: "", country: paymentMethod.billing_details.address?.country } }
                    : {}),
            });
        });
    }

    async getPortalUrlForAttributionId(attributionId: string, returnUrl: string): Promise<string> {
        const customerId = await this.findCustomerByAttributionId(attributionId);
        if (!customerId) {
            throw new Error(`No Stripe Customer ID found for '${attributionId}'`);
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
            throw new Error(`Stripe customer '${customerId}') has more than one subscription!`);
        }
        return result.data[0]?.id;
    }

    async cancelSubscription(subscriptionId: string): Promise<void> {
        await reportStripeOutcome("subscriptions_cancel", () => {
            return this.getStripe().subscriptions.del(subscriptionId, { invoice_now: true });
        });
    }

    async createSubscriptionForCustomer(customerId: string, attributionId: string): Promise<void> {
        const customer = await reportStripeOutcome("customers_get", () => {
            return this.getStripe().customers.retrieve(customerId, { expand: ["tax"] });
        });
        if (!customer || customer.deleted) {
            throw new Error(`Stripe customer '${customerId}' could not be found`);
        }
        const attrId = AttributionId.parse(attributionId);
        if (!attrId) {
            throw new Error(`Invalid attributionId '${attributionId}'`);
        }
        const currency = customer.metadata.preferredCurrency || "USD";
        let priceIds: { [currency: string]: string } | undefined;
        if (attrId.kind === "team") {
            priceIds = this.config.stripeConfig?.teamUsagePriceIds;
        } else if (attrId.kind === "user") {
            priceIds = this.config.stripeConfig?.individualUsagePriceIds;
        } else {
            throw new Error(`Unsupported attribution kind '${(attrId as any).kind}'`);
        }
        const priceId = priceIds && priceIds[currency];
        if (!priceId) {
            throw new Error(
                `No Stripe Price ID configured for attribution kind '${attrId.kind}' and currency '${currency}'`,
            );
        }
        const isAutomaticTaxSupported = customer.tax?.automatic_tax === "supported";
        if (!isAutomaticTaxSupported) {
            log.warn("Automatic Stripe tax is not supported for this customer", {
                customerId,
                taxInformation: customer.tax,
            });
        }
        const startOfNextMonth = new Date(new Date().toISOString().slice(0, 7) + "-01"); // First day of this month (YYYY-MM-01)
        startOfNextMonth.setMonth(startOfNextMonth.getMonth() + 1); // Add one month

        await reportStripeOutcome("subscriptions_create", () => {
            return this.getStripe().subscriptions.create({
                customer: customer.id,
                items: [{ price: priceId }],
                automatic_tax: { enabled: isAutomaticTaxSupported },
                billing_cycle_anchor: Math.round(startOfNextMonth.getTime() / 1000),
            });
        });
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
