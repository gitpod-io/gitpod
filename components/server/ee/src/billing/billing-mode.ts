/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";

import { Team, User } from "@gitpod/gitpod-protocol";
import { ConfigCatClientFactory } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { SubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import { Subscription } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { Config } from "../../../src/config";
import { StripeService } from "../user/stripe-service";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { TeamDB, TeamSubscription2DB, UserDB } from "@gitpod/gitpod-db/lib";
import { Plans } from "@gitpod/gitpod-protocol/lib/plans";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { TeamSubscription2 } from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";

export const BillingModes = Symbol("BillingModes");
export interface BillingModes {
    getBillingMode(attributionId: AttributionId, now: Date): Promise<BillingMode>;
    getBillingModeForUser(user: User, now: Date): Promise<BillingMode>;
    getBillingModeForTeam(team: Team, now: Date): Promise<BillingMode>;
}

@injectable()
export class BillingModesImpl implements BillingModes {
    @inject(Config) protected readonly config: Config;
    @inject(ConfigCatClientFactory) protected readonly configCatClientFactory: ConfigCatClientFactory;
    @inject(SubscriptionService) protected readonly subscriptionSvc: SubscriptionService;
    @inject(StripeService) protected readonly stripeSvc: StripeService;
    @inject(TeamSubscription2DB) protected readonly teamSubscription2Db: TeamSubscription2DB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(UserDB) protected readonly userDB: UserDB;

    async getBillingMode(attributionId: AttributionId, now: Date): Promise<BillingMode> {
        switch (attributionId.kind) {
            case "team":
                const team = await this.teamDB.findTeamById(attributionId.teamId);
                if (!team) {
                    throw new Error(`Cannot find team with id '${attributionId.teamId}'!`);
                }
                return this.getBillingModeForTeam(team, now);
            case "user":
                const user = await this.userDB.findUserById(attributionId.userId);
                if (!user) {
                    throw new Error(`Cannot find user with id '${attributionId.userId}'!`);
                }
                return this.getBillingModeForUser(user, now);
        }
    }

    async getBillingModeForUser(user: User, now: Date): Promise<BillingMode> {
        if (!this.config.enablePayment) {
            // Payment is not enabled. E.g. Self-Hosted.
            return { mode: "none" };
        }

        // Is Usage Based Billing enabled for this user or not?
        const teams = await this.teamDB.findTeamsByUser(user.id);
        const isUsageBasedBillingEnabled = await this.configCatClientFactory().getValueAsync(
            "isUsageBasedBillingEnabled",
            false,
            {
                user,
                teams,
            },
        );

        // Any Chargebee subscriptions? This includes those derived from a Team Seat!
        const cbSubscriptions = await this.subscriptionSvc.getActivePaidSubscription(user.id, now);
        if (cbSubscriptions.length > 0) {
            const planIds = cbSubscriptions.map((s) => s.planId!);
            if (
                isUsageBasedBillingEnabled &&
                cbSubscriptions.every((s) => Subscription.isCancelled(s, now.toISOString()))
            ) {
                // The user has one or more paid subscriptions, but all of them have already been cancelled
                return { mode: "chargebee", tier: "paid_cancelled_and_ubb", planIds };
            }

            // The user has at least one paid subscription
            const hasPersonalPlan = cbSubscriptions.some((s) => !Plans.getById(s.planId)?.team);
            return {
                mode: "chargebee",
                tier: "paid",
                planIds,
                hasPersonalPlan,
            };
        }

        // UBB enabled?
        if (!isUsageBasedBillingEnabled) {
            // No Chargebee subscription, and UBB is not enabled: CB free tier?
            return { mode: "chargebee", tier: "free" };
        }

        // Stripe: Active personal subsciption?
        const customer = await this.stripeSvc.findCustomerByUserId(user.id);
        if (customer) {
            const subscription = await this.stripeSvc.findUncancelledSubscriptionByCustomer(customer.id);
            if (subscription) {
                return { mode: "usage-based", tier: "paid" };
            }
        }

        // Team membership is not relevant here, because we're interested in the user perspective
        return { mode: "usage-based", tier: "free" };
    }

    async getBillingModeForTeam(team: Team, _now: Date): Promise<BillingMode> {
        if (!this.config.enablePayment) {
            // Payment is not enabled. E.g. Self-Hosted.
            return { mode: "none" };
        }
        const now = _now.toISOString();

        // Is Usage Based Billing enabled for this team?
        const isUsageBasedBillingEnabled = await this.configCatClientFactory().getValueAsync(
            "isUsageBasedBillingEnabled",
            false,
            {
                teamId: team.id,
                teamName: team.name,
            },
        );

        // Check TeamSubscription2 (old Team Subscriptions are not relevant here, as they are not associated with a team)
        const teamSubscription = await this.teamSubscription2Db.findForTeam(team.id, now);
        if (teamSubscription && TeamSubscription2.isActive(teamSubscription, now)) {
            if (isUsageBasedBillingEnabled && TeamSubscription2.isCancelled(teamSubscription, now)) {
                // The team has a paid subscription, but it's already cancelled, and UBB enabled
                return { mode: "chargebee", tier: "paid_cancelled_and_ubb", planIds: [teamSubscription.planId] };
            }

            return { mode: "chargebee", tier: "paid", planIds: [teamSubscription.planId] };
        }

        if (!isUsageBasedBillingEnabled) {
            return { mode: "chargebee", tier: "free" };
        }

        // Stripe: Active subsciption?
        const customer = await this.stripeSvc.findCustomerByTeamId(team.id);
        if (customer) {
            const subscription = await this.stripeSvc.findUncancelledSubscriptionByCustomer(customer.id);
            if (subscription) {
                return { mode: "usage-based", tier: "paid" };
            }
        }
        return { mode: "usage-based", tier: "free" };
    }
}
