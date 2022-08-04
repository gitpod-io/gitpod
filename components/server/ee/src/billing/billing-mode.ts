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

/**
 *
 * Some rules for how we decide about BillingMode someone is in:
 *  - Teams: Do they have either:
 *    - Chargebee subscription              => cb
 *    - UBB (& maybe Stripe subscription):  => ubb
 *  - Users: Do they have either:
 *    - personal Chargebee subscription     => cb
 *    - personal Stripe Subscription        => ubb
 *    - at least one Stripe Team seat       => ubb
 */
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

        // 1. UBB enabled?
        if (!isUsageBasedBillingEnabled) {
            // UBB is not enabled: definitely chargebee
            return { mode: "chargebee" };
        }

        // 2. Any personal subscriptions?
        // Chargebee takes precedence
        function isTeamSubscription(s: Subscription): boolean {
            return !!Plans.getById(s.planId)?.team;
        }
        const cbSubscriptions = await this.subscriptionSvc.getActivePaidSubscription(user.id, now);
        const cbTeamSubscriptions = cbSubscriptions.filter((s) => isTeamSubscription(s));
        const cbPersonalSubscriptions = cbSubscriptions.filter((s) => !isTeamSubscription(s));
        if (cbPersonalSubscriptions.length > 0) {
            if (cbPersonalSubscriptions.every((s) => Subscription.isCancelled(s, now.toISOString()))) {
                // The user has one or more paid subscriptions, but all of them have already been cancelled
                return { mode: "chargebee", canUpgradeToUBB: true };
            }

            // The user has at least one paid personal subscription
            return {
                mode: "chargebee",
            };
        }

        // Stripe: Active personal subsciption?
        const customer = await this.stripeSvc.findCustomerByUserId(user.id);
        if (customer) {
            const subscription = await this.stripeSvc.findUncancelledSubscriptionByCustomer(customer.id);
            if (subscription) {
                return { mode: "usage-based" };
            }
        }

        // 3. Check team memberships/plans
        // UBB overrides wins if there is _any_. But if there is none, use the existing Chargebee subscription.
        const teamsModes = await Promise.all(teams.map((t) => this.getBillingModeForTeam(t, now)));
        const hasUbbTeam = teamsModes.some((tm) => tm.mode === "usage-based");
        const hasCbTeam = teamsModes.some((tm) => tm.mode === "chargebee");
        const hasCbTeamSeat = cbTeamSubscriptions.length > 0;

        if (hasUbbTeam) {
            return { mode: "usage-based" }; // UBB is gready: once a user has at least a team seat, they should benefit from it!
        }
        if (hasCbTeam || hasCbTeamSeat) {
            // TODO(gpl): Q: How to test the free-tier, then? A: Make sure you have no CB seats anymore
            // For that we could add a new field here, which lists all seats that are "blocking" you, and display them in the UI somewhere.
            return { mode: "chargebee", canUpgradeToUBB: true }; // UBB is enabled, but no seat nor subscription yet.
        }

        // UBB free tier
        return { mode: "usage-based" };
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

        // 1. UBB enabled?
        if (!isUsageBasedBillingEnabled) {
            return { mode: "chargebee" };
        }

        // 2. Any Chargbee TeamSubscription2 (old Team Subscriptions are not relevant here, as they are not associated with a team)
        const teamSubscription = await this.teamSubscription2Db.findForTeam(team.id, now);
        if (teamSubscription && TeamSubscription2.isActive(teamSubscription, now)) {
            if (TeamSubscription2.isCancelled(teamSubscription, now)) {
                // The team has a paid subscription, but it's already cancelled, and UBB enabled
                return { mode: "chargebee", canUpgradeToUBB: true };
            }

            return { mode: "chargebee" };
        }

        // 3. If not: we don't even have to check for a team subscription
        return { mode: "usage-based" };
    }
}
