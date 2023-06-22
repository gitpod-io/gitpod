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
