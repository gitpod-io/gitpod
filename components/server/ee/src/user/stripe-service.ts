/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { inject, injectable } from "inversify";
import Stripe from "stripe";
import { Team, User } from "@gitpod/gitpod-protocol";
import { Config } from "../../../src/config";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";

const POLL_CREATED_CUSTOMER_INTERVAL_MS = 1000;
const POLL_CREATED_CUSTOMER_MAX_ATTEMPTS = 30;

@injectable()
export class StripeService {
    @inject(Config) protected readonly config: Config;

    protected _stripe: Stripe | undefined;

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
        return await this.getStripe().setupIntents.create({ usage: "on_session" });
    }

    async findCustomerByUserId(userId: string): Promise<Stripe.Customer | undefined> {
        return this.findCustomerByAttributionId(AttributionId.render({ kind: "user", userId }));
    }

    async findCustomerByTeamId(teamId: string): Promise<Stripe.Customer | undefined> {
        return this.findCustomerByAttributionId(AttributionId.render({ kind: "team", teamId }));
    }

    async findCustomerByAttributionId(attributionId: string): Promise<Stripe.Customer | undefined> {
        const query = `metadata['attributionId']:'${attributionId}'`;
        const result = await this.getStripe().customers.search({ query });
        if (result.data.length > 1) {
            throw new Error(`Found more than one Stripe customer for query '${query}'`);
        }
        return result.data[0];
    }

    async createCustomerForUser(user: User): Promise<Stripe.Customer> {
        const attributionId = AttributionId.render({ kind: "user", userId: user.id });
        if (await this.findCustomerByAttributionId(attributionId)) {
            throw new Error(`A Stripe customer already exists for user '${user.id}'`);
        }
        // Create the customer in Stripe
        const customer = await this.getStripe().customers.create({
            email: User.getPrimaryEmail(user),
            name: User.getName(user),
            metadata: { attributionId },
        });
        // Wait for the customer to show up in Stripe search results before proceeding
        let attempts = 0;
        while (!(await this.findCustomerByAttributionId(attributionId))) {
            await new Promise((resolve) => setTimeout(resolve, POLL_CREATED_CUSTOMER_INTERVAL_MS));
            if (++attempts > POLL_CREATED_CUSTOMER_MAX_ATTEMPTS) {
                throw new Error(`Could not confirm Stripe customer creation for user '${user.id}'`);
            }
        }
        return customer;
    }

    async createCustomerForTeam(user: User, team: Team): Promise<Stripe.Customer> {
        const attributionId = AttributionId.render({ kind: "team", teamId: team.id });
        if (await this.findCustomerByAttributionId(attributionId)) {
            throw new Error(`A Stripe customer already exists for team '${team.id}'`);
        }
        // Create the customer in Stripe
        const userName = User.getName(user);
        const customer = await this.getStripe().customers.create({
            email: User.getPrimaryEmail(user),
            name: userName ? `${userName} (${team.name})` : team.name,
            metadata: { attributionId },
        });
        // Wait for the customer to show up in Stripe search results before proceeding
        let attempts = 0;
        while (!(await this.findCustomerByAttributionId(attributionId))) {
            await new Promise((resolve) => setTimeout(resolve, POLL_CREATED_CUSTOMER_INTERVAL_MS));
            if (++attempts > POLL_CREATED_CUSTOMER_MAX_ATTEMPTS) {
                throw new Error(`Could not confirm Stripe customer creation for team '${team.id}'`);
            }
        }
        return customer;
    }

    async setPreferredCurrencyForCustomer(customer: Stripe.Customer, currency: string): Promise<void> {
        await this.getStripe().customers.update(customer.id, { metadata: { preferredCurrency: currency } });
    }

    async setDefaultPaymentMethodForCustomer(customer: Stripe.Customer, setupIntentId: string): Promise<void> {
        const setupIntent = await this.getStripe().setupIntents.retrieve(setupIntentId);
        if (typeof setupIntent.payment_method !== "string") {
            throw new Error("The provided Stripe SetupIntent does not have a valid payment method attached");
        }
        // Attach the provided payment method to the customer
        await this.getStripe().paymentMethods.attach(setupIntent.payment_method, {
            customer: customer.id,
        });
        const paymentMethod = await this.getStripe().paymentMethods.retrieve(setupIntent.payment_method);
        await this.getStripe().customers.update(customer.id, {
            invoice_settings: { default_payment_method: setupIntent.payment_method },
            ...(paymentMethod.billing_details.address?.country
                ? { address: { line1: "", country: paymentMethod.billing_details.address?.country } }
                : {}),
        });
    }

    async getPortalUrlForTeam(team: Team): Promise<string> {
        const customer = await this.findCustomerByTeamId(team.id);
        if (!customer) {
            throw new Error(`No Stripe Customer ID found for team '${team.id}'`);
        }
        const session = await this.getStripe().billingPortal.sessions.create({
            customer: customer.id,
            return_url: this.config.hostUrl.with(() => ({ pathname: `/t/${team.slug}/billing` })).toString(),
        });
        return session.url;
    }

    async getPortalUrlForUser(user: User): Promise<string> {
        const customer = await this.findCustomerByUserId(user.id);
        if (!customer) {
            throw new Error(`No Stripe Customer ID found for user '${user.id}'`);
        }
        const session = await this.getStripe().billingPortal.sessions.create({
            customer: customer.id,
            return_url: this.config.hostUrl.with(() => ({ pathname: `/billing` })).toString(),
        });
        return session.url;
    }

    async findUncancelledSubscriptionByCustomer(customerId: string): Promise<Stripe.Subscription | undefined> {
        const result = await this.getStripe().subscriptions.list({
            customer: customerId,
        });
        if (result.data.length > 1) {
            throw new Error(`Stripe customer '${customerId}') has more than one subscription!`);
        }
        return result.data[0];
    }

    async cancelSubscription(subscriptionId: string): Promise<void> {
        await this.getStripe().subscriptions.del(subscriptionId);
    }

    async createSubscriptionForCustomer(customer: Stripe.Customer): Promise<void> {
        const currency = customer.metadata.preferredCurrency || "USD";
        const priceId = this.config?.stripeConfig?.usageProductPriceIds[currency];
        if (!priceId) {
            throw new Error(`No Stripe Price ID configured for currency '${currency}'`);
        }
        const startOfNextMonth = new Date(new Date().toISOString().slice(0, 7) + "-01"); // First day of this month (YYYY-MM-01)
        startOfNextMonth.setMonth(startOfNextMonth.getMonth() + 1); // Add one month
        await this.getStripe().subscriptions.create({
            customer: customer.id,
            items: [{ price: priceId }],
            billing_cycle_anchor: Math.round(startOfNextMonth.getTime() / 1000),
        });
    }
}
