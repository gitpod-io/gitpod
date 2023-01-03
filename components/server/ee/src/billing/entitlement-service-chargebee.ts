/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamDB, TeamSubscription2DB, TeamSubscriptionDB } from "@gitpod/gitpod-db/lib";
import { Accounting, SubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import {
    BillingTier,
    User,
    Workspace,
    WorkspaceInstance,
    WorkspaceTimeoutDuration,
    WORKSPACE_TIMEOUT_DEFAULT_LONG,
    WORKSPACE_TIMEOUT_DEFAULT_SHORT,
} from "@gitpod/gitpod-protocol";
import { RemainingHours } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { MAX_PARALLEL_WORKSPACES, Plans } from "@gitpod/gitpod-protocol/lib/plans";
import { millisecondsToHours } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { inject, injectable } from "inversify";
import {
    EntitlementService,
    HitParallelWorkspaceLimit,
    MayStartWorkspaceResult,
} from "../../../src/billing/entitlement-service";
import { Config } from "../../../src/config";
import { AccountStatementProvider, CachedAccountStatement } from "../user/account-statement-provider";

@injectable()
export class EntitlementServiceChargebee implements EntitlementService {
    @inject(Config) protected readonly config: Config;
    @inject(SubscriptionService) protected readonly subscriptionService: SubscriptionService;
    @inject(AccountStatementProvider) protected readonly accountStatementProvider: AccountStatementProvider;
    @inject(TeamSubscriptionDB) protected readonly teamSubscriptionDb: TeamSubscriptionDB;
    @inject(TeamDB) protected readonly teamDb: TeamDB;
    @inject(TeamSubscription2DB) protected readonly teamSubscription2Db: TeamSubscription2DB;

    async mayStartWorkspace(
        user: User,
        workspace: Workspace,
        date: Date,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<MayStartWorkspaceResult> {
        const hasHitParallelWorkspaceLimit = async (): Promise<HitParallelWorkspaceLimit | undefined> => {
            const max = await this.getMaxParallelWorkspaces(user);
            const instances = (await runningInstances).filter((i) => i.status.phase !== "preparing");
            const current = instances.length; // >= parallelWorkspaceAllowance;
            if (current >= max) {
                return {
                    current,
                    max,
                };
            } else {
                return undefined;
            }
        };
        const [enoughCredits, hitParallelWorkspaceLimit] = await Promise.all([
            this.checkEnoughCreditForWorkspaceStart(user.id, date, runningInstances),
            hasHitParallelWorkspaceLimit(),
        ]);

        return {
            oufOfCredits: !enoughCredits,
            hitParallelWorkspaceLimit,
        };
    }

    /**
     * Returns the maximum number of parallel workspaces a user can run at the same time.
     * @param user
     * @param date The date for which we want to know whether the user is allowed to set a timeout (depends on active subscription)
     */
    protected async getMaxParallelWorkspaces(user: User, date: Date = new Date()): Promise<number> {
        const subscriptions = await this.subscriptionService.getNotYetCancelledSubscriptions(user, date.toISOString());
        return subscriptions.map((s) => Plans.getParallelWorkspacesById(s.planId)).reduce((p, v) => Math.max(p, v));
    }

    protected async checkEnoughCreditForWorkspaceStart(
        userId: string,
        date: Date,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<boolean> {
        // As retrieving a full AccountStatement is expensive we want to cache it as much as possible.
        const cachedAccountStatement = this.accountStatementProvider.getCachedStatement(userId);
        const lowerBound = this.getRemainingUsageHoursLowerBound(cachedAccountStatement, date.toISOString());
        if (lowerBound && (lowerBound === "unlimited" || lowerBound > Accounting.MINIMUM_CREDIT_FOR_OPEN_IN_HOURS)) {
            return true;
        }

        const remainingUsageHours = await this.accountStatementProvider.getRemainingUsageHours(
            userId,
            date.toISOString(),
            runningInstances,
        );
        return remainingUsageHours > Accounting.MINIMUM_CREDIT_FOR_OPEN_IN_HOURS;
    }

    /**
     * Tries to calculate the lower bound of remaining usage hours based on cached AccountStatements
     * with the goal to improve workspace startup times.
     */
    protected getRemainingUsageHoursLowerBound(
        cachedStatement: CachedAccountStatement | undefined,
        date: string,
    ): RemainingHours | undefined {
        if (!cachedStatement) {
            return undefined;
        }
        if (cachedStatement.remainingHours === "unlimited") {
            return "unlimited";
        }

        const diffInMillis = Math.max(0, new Date(cachedStatement.endDate).getTime() - new Date(date).getTime());
        const maxPossibleUsage = millisecondsToHours(diffInMillis) * MAX_PARALLEL_WORKSPACES;
        return cachedStatement.remainingHours - maxPossibleUsage;
    }

    async maySetTimeout(user: User, date: Date = new Date()): Promise<boolean> {
        const subscriptions = await this.subscriptionService.getNotYetCancelledSubscriptions(user, date.toISOString());
        const eligblePlans = [
            Plans.PROFESSIONAL_EUR,
            Plans.PROFESSIONAL_USD,
            Plans.PROFESSIONAL_STUDENT_EUR,
            Plans.PROFESSIONAL_STUDENT_USD,
            Plans.TEAM_PROFESSIONAL_EUR,
            Plans.TEAM_PROFESSIONAL_USD,
            Plans.TEAM_PROFESSIONAL_STUDENT_EUR,
            Plans.TEAM_PROFESSIONAL_STUDENT_USD,
        ].map((p) => p.chargebeeId);

        return subscriptions.filter((s) => eligblePlans.includes(s.planId!)).length > 0;
    }

    async getDefaultWorkspaceTimeout(user: User, date: Date = new Date()): Promise<WorkspaceTimeoutDuration> {
        if (await this.maySetTimeout(user, date)) {
            return WORKSPACE_TIMEOUT_DEFAULT_LONG;
        } else {
            return WORKSPACE_TIMEOUT_DEFAULT_SHORT;
        }
    }

    /**
     * Returns true if the user ought to land on a workspace cluster that provides more resources
     * compared to the default case.
     */
    async userGetsMoreResources(user: User): Promise<boolean> {
        const subscriptions = await this.subscriptionService.getNotYetCancelledSubscriptions(
            user,
            new Date().toISOString(),
        );
        const eligiblePlans = [Plans.TEAM_PROFESSIONAL_EUR, Plans.TEAM_PROFESSIONAL_USD].map((p) => p.chargebeeId);

        const relevantSubscriptions = subscriptions.filter((s) => eligiblePlans.includes(s.planId!));
        if (relevantSubscriptions.length === 0) {
            // user has no subscription that grants "more resources"
            return false;
        }

        // some TeamSubscriptions are marked with 'excludeFromMoreResources' to convey that those are _not_ receiving more resources
        const excludeFromMoreResources = await Promise.all(
            relevantSubscriptions.map(async (s): Promise<boolean> => {
                if (s.teamMembershipId) {
                    const team = await this.teamDb.findTeamByMembershipId(s.teamMembershipId);
                    if (!team) {
                        return true;
                    }
                    const ts2 = await this.teamSubscription2Db.findForTeam(team.id, new Date().toISOString());
                    if (!ts2) {
                        return true;
                    }
                    return ts2.excludeFromMoreResources;
                }
                if (!s.teamSubscriptionSlotId) {
                    return false;
                }
                const ts = await this.teamSubscriptionDb.findTeamSubscriptionBySlotId(s.teamSubscriptionSlotId);
                return !!ts?.excludeFromMoreResources;
            }),
        );
        if (excludeFromMoreResources.every((b) => b)) {
            // if all TS the user is part of are marked this way, we deny that privilege
            return false;
        }

        return true;
    }

    /**
     * Returns true if network connections should be limited
     * @param user
     */
    async limitNetworkConnections(user: User, date: Date = new Date()): Promise<boolean> {
        const hasPaidPlan = await this.hasPaidSubscription(user, date);
        return !hasPaidPlan;
    }

    protected async hasPaidSubscription(user: User, date: Date): Promise<boolean> {
        const subscriptions = await this.subscriptionService.getNotYetCancelledSubscriptions(user, date.toISOString());
        return subscriptions.some((s) => !Plans.isFreeTier(s.planId));
    }

    async getBillingTier(user: User): Promise<BillingTier> {
        const hasPaidPlan = await this.hasPaidSubscription(user, new Date());
        return hasPaidPlan ? "paid" : "free";
    }
}
