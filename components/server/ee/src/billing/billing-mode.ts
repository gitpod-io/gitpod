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
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { TeamDB, TeamSubscription2DB, TeamSubscriptionDB, UserDB } from "@gitpod/gitpod-db/lib";
import { Plans } from "@gitpod/gitpod-protocol/lib/plans";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { TeamSubscription, TeamSubscription2 } from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";
import { CostCenter_BillingStrategy } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { UsageService } from "../../../src/user/usage-service";

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
    @inject(UsageService) protected readonly usageService: UsageService;
    @inject(TeamSubscriptionDB) protected readonly teamSubscriptionDb: TeamSubscriptionDB;
    @inject(TeamSubscription2DB) protected readonly teamSubscription2Db: TeamSubscription2DB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(UserDB) protected readonly userDB: UserDB;

    public async getBillingMode(attributionId: AttributionId, now: Date): Promise<BillingMode> {
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
        let isUsageBasedBillingEnabled = false;
        if (teams.length > 0) {
            for (const team of teams) {
                // Checking here doesn't actually block on every team as the flags are fetched once and catched, subsequent calls are non-blocking.
                const isEnabled = await this.configCatClientFactory().getValueAsync(
                    "isUsageBasedBillingEnabled",
                    false,
                    {
                        user,
                        teamId: team.id,
                        teamName: team.name,
                    },
                );
                if (isEnabled) {
                    isUsageBasedBillingEnabled = true;
                    break;
                }
            }
            // No need to check the user, because ConfigCat rules would have already flagged them with one of the calls above.
        } else {
            isUsageBasedBillingEnabled = await this.configCatClientFactory().getValueAsync(
                "isUsageBasedBillingEnabled",
                false,
                {
                    user,
                },
            );
        }

        // 1. UBB enabled?
        if (!isUsageBasedBillingEnabled) {
            // UBB is not enabled: definitely chargebee
            return { mode: "chargebee" };
        }

        // 2. Any personal subscriptions?
        // Chargebee takes precedence
        function isPersonalSubscription(s: Subscription): boolean {
            return !Plans.getById(s.planId)?.team;
        }
        function isOldTeamSubscription(s: Subscription): boolean {
            return !!Plans.getById(s.planId)?.team && !s.teamMembershipId;
        }
        const cbSubscriptions = await this.subscriptionSvc.getActivePaidSubscription(user.id, now);
        const cbTeamSubscriptions = cbSubscriptions.filter((s) => isOldTeamSubscription(s));
        const cbPersonalSubscriptions = cbSubscriptions.filter(
            (s) => isPersonalSubscription(s) && s.planId !== Plans.FREE_OPEN_SOURCE.chargebeeId,
        );
        const cbOwnedTeamSubscriptions = (
            await this.teamSubscriptionDb.findTeamSubscriptions({ userId: user.id })
        ).filter((ts) => TeamSubscription.isActive(ts, now.toISOString()));

        let canUpgradeToUBB = false;
        if (cbPersonalSubscriptions.length > 0) {
            if (cbPersonalSubscriptions.every((s) => Subscription.isCancelled(s, now.toISOString()))) {
                // The user has one or more paid subscriptions, but all of them have already been cancelled
                canUpgradeToUBB = true;
            } else {
                // The user has at least one paid personal subscription
                return {
                    mode: "chargebee",
                };
            }
        }

        // Stripe: Active personal subsciption?
        let hasUbbPersonal = false;
        const billingStrategy = await this.usageService.getCurrentBillingStategy({ kind: "user", userId: user.id });
        if (billingStrategy === CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE) {
            hasUbbPersonal = true;
        }

        // 3. Check team memberships/plans
        // UBB overrides wins if there is _any_. But if there is none, use the existing Chargebee subscription.
        const teamsModes = await Promise.all(teams.map((t) => this.getBillingModeForTeam(t, now)));
        const hasUbbPaidTeamMembership = teamsModes.some((tm) => tm.mode === "usage-based" && !!tm.paid);
        const hasCbPaidTeamMembership = teamsModes.some((tm) => tm.mode === "chargebee" && !!tm.paid);
        const hasCbPaidTeamSeat = cbTeamSubscriptions.length > 0;
        const hasCbPaidTeamSubscription = cbOwnedTeamSubscriptions.length > 0;

        function usageBased() {
            const result: BillingMode = { mode: "usage-based" };
            if (hasCbPaidTeamMembership) {
                result.hasChargebeeTeamPlan = true;
            }
            if (hasCbPaidTeamSeat || hasCbPaidTeamSubscription) {
                result.hasChargebeeTeamSubscription = true;
            }
            return result;
        }

        if (hasUbbPaidTeamMembership || hasUbbPersonal) {
            // UBB is greedy: once a user has at least a paid team membership, they should benefit from it!
            return usageBased();
        }
        if (hasCbPaidTeamMembership || hasCbPaidTeamSeat || canUpgradeToUBB) {
            // Q: How to test the free-tier, then? A: Make sure you have no CB paid seats anymore
            // For that we lists all Team Subscriptions/Team Memberships that are "blocking" you, and display them in the UI somewhere.
            const result: BillingMode = { mode: "chargebee", canUpgradeToUBB }; // UBB is enabled, but no seat nor subscription yet.

            const teamNames = [];
            for (const tm of teamsModes) {
                if (tm.mode === "chargebee" && tm.teamNames) {
                    teamNames.push(`Team Membership: ${tm.teamNames}`);
                }
            }
            const tsOwners = await Promise.all(cbTeamSubscriptions.map((s) => this.mapTeamSubscriptionToOwnerName(s)));
            for (const owner of tsOwners) {
                if (!owner) {
                    continue;
                }
                const [ts, ownerName] = owner;
                teamNames.push(`Team Subscription '${Plans.getById(ts.planId)?.name}' (owner: ${ownerName})`);
            }
            if (teamNames.length > 0) {
                result.teamNames = teamNames;
            }

            return result;
        }

        // UBB free tier
        return usageBased();
    }

    protected async mapTeamSubscriptionToOwnerName(s: Subscription): Promise<[TeamSubscription, string] | undefined> {
        if (!s || !s.teamSubscriptionSlotId) {
            return undefined;
        }
        const ts = await this.teamSubscriptionDb.findTeamSubscriptionBySlotId(s.teamSubscriptionSlotId!);
        if (!ts) {
            return undefined;
        }
        const user = await this.userDB.findUserById(ts.userId);
        if (!user) {
            return undefined;
        }
        return [ts, user.name || user.fullName || "---"];
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

        // 1. Check Chargebee: Any TeamSubscription2 (old Team Subscriptions are not relevant here, as they are not associated with a team)
        const teamSubscription = await this.teamSubscription2Db.findForTeam(team.id, now);
        if (teamSubscription && TeamSubscription2.isActive(teamSubscription, now)) {
            if (TeamSubscription2.isCancelled(teamSubscription, now)) {
                // The team has a paid subscription, but it's already cancelled, and UBB enabled
                return { mode: "chargebee", canUpgradeToUBB: isUsageBasedBillingEnabled };
            }

            return { mode: "chargebee", teamNames: [team.name], paid: true };
        }

        // 2. UBB enabled at all?
        if (!isUsageBasedBillingEnabled) {
            return { mode: "chargebee" };
        }

        // 3. Now we're usage-based. We only have to figure out whether we have a plan yet or not.
        const result: BillingMode = { mode: "usage-based" };
        const billingStrategy = await this.usageService.getCurrentBillingStategy(AttributionId.create(team));
        if (billingStrategy === CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE) {
            result.paid = true;
        }
        return result;
    }
}
