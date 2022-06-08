/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { inject, injectable } from "inversify";
import Stripe from "stripe";
import { Team, User } from "@gitpod/gitpod-protocol";
import { Config } from "../../../src/config";

@injectable()
export class StripeService {
    @inject(Config) protected readonly config: Config;

    protected _stripe: Stripe | undefined;

    protected getStripe(): Stripe {
        if (!this._stripe) {
            if (!this.config.stripeSettings?.secretKey) {
                throw new Error("Stripe is not properly configured");
            }
            this._stripe = new Stripe(this.config.stripeSettings.secretKey, { apiVersion: "2020-08-27" });
        }
        return this._stripe;
    }

    async createSetupIntent(): Promise<Stripe.SetupIntent> {
        return await this.getStripe().setupIntents.create({ usage: "on_session" });
    }

    async findCustomerByUserId(userId: string): Promise<Stripe.Customer | undefined> {
        const result = await this.getStripe().customers.search({
            query: `metadata['userId']:'${userId}'`,
        });
        if (result.data.length > 1) {
            throw new Error(`Found more than one Stripe customer for user '${userId}'`);
        }
        return result.data[0];
    }

    async findCustomerByTeamId(teamId: string): Promise<Stripe.Customer | undefined> {
        const result = await this.getStripe().customers.search({
            query: `metadata['teamId']:'${teamId}'`,
        });
        if (result.data.length > 1) {
            throw new Error(`Found more than one Stripe customer for team '${teamId}'`);
        }
        return result.data[0];
    }

    async createCustomerForUser(user: User, setupIntentId: string): Promise<Stripe.Customer> {
        if (await this.findCustomerByUserId(user.id)) {
            throw new Error(`A Stripe customer already exists for user '${user.id}'`);
        }
        const setupIntent = await this.getStripe().setupIntents.retrieve(setupIntentId);
        if (typeof setupIntent.payment_method !== "string") {
            throw new Error("The provided Stripe SetupIntent does not have a valid payment method attached");
        }
        // Create the customer in Stripe
        const customer = await this.getStripe().customers.create({
            email: User.getPrimaryEmail(user),
            name: User.getName(user),
            metadata: {
                userId: user.id,
            },
        });
        // Attach the provided payment method to the customer
        await this.getStripe().paymentMethods.attach(setupIntent.payment_method, {
            customer: customer.id,
        });
        await this.getStripe().customers.update(customer.id, {
            invoice_settings: { default_payment_method: setupIntent.payment_method },
        });
        return customer;
    }

    async createCustomerForTeam(user: User, team: Team, setupIntentId: string): Promise<Stripe.Customer> {
        if (await this.findCustomerByTeamId(team.id)) {
            throw new Error(`A Stripe customer already exists for team '${team.id}'`);
        }
        const setupIntent = await this.getStripe().setupIntents.retrieve(setupIntentId);
        if (typeof setupIntent.payment_method !== "string") {
            throw new Error("The provided Stripe SetupIntent does not have a valid payment method attached");
        }
        // Create the customer in Stripe
        const userName = User.getName(user);
        const customer = await this.getStripe().customers.create({
            email: User.getPrimaryEmail(user),
            name: userName ? `${userName} (${team.name})` : team.name,
            metadata: {
                teamId: team.id,
            },
        });
        // Attach the provided payment method to the customer
        await this.getStripe().paymentMethods.attach(setupIntent.payment_method, {
            customer: customer.id,
        });
        await this.getStripe().customers.update(customer.id, {
            invoice_settings: { default_payment_method: setupIntent.payment_method },
        });
        return customer;
    }
}
