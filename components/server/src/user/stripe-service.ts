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
import { ResponseError } from "vscode-ws-jsonrpc";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";

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

    async getPortalUrlForAttributionId(attributionId: string, returnUrl: string): Promise<string> {
        const customerId = await this.findCustomerByAttributionId(attributionId);
        if (!customerId) {
            throw new ResponseError(
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

    async getPriceInformation(attributionId: string): Promise<string> {
        const priceInformation = await this.billingService.getPriceInformation({ attributionId });
        return priceInformation.humanReadableDescription;
    }

    async cancelSubscriptionForUser(userId: string) {
        let subscriptionId;
        try {
            subscriptionId = await this.findUncancelledSubscriptionByAttributionId(
                AttributionId.render({ kind: "user", userId }),
            );
            if (subscriptionId) {
                await this.cancelSubscription(subscriptionId);
            }
        } catch (error) {
            log.error("Error cancelling Stripe user subscription", error, { subscriptionId });
            throw new Error(`Failed to cancel stripe subscription. ${error}`);
        }
    }

    protected async cancelSubscription(subscriptionId: string): Promise<void> {
        await reportStripeOutcome("subscriptions_cancel", () => {
            return this.getStripe().subscriptions.del(subscriptionId, { invoice_now: true });
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
